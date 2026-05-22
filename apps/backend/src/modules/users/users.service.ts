import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentUser(userId: string) {
    const client = await this.prisma.getClient();

    const user = await client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        coverImageUrl: true,
        bio: true,
        travelVibes: true,
        favoriteCategories: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl ?? null,
      coverImageUrl: user.coverImageUrl ?? null,
      bio: user.bio ?? null,
      travelVibes: user.travelVibes,
      favoriteCategories: user.favoriteCategories,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      followerCount: user._count.followers,
      followingCount: user._count.following,
    };
  }

  async updateCurrentUser(userId: string, dto: UpdateUserDto) {
    const client = await this.prisma.getClient();

    const data: Record<string, unknown> = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName || null;
    if (dto.bio !== undefined) data.bio = dto.bio || null;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;
    if (dto.coverImageUrl !== undefined) data.coverImageUrl = dto.coverImageUrl;
    if (dto.travelVibes !== undefined) data.travelVibes = dto.travelVibes;
    if (dto.favoriteCategories !== undefined) data.favoriteCategories = dto.favoriteCategories;

    const user = await client.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        coverImageUrl: true,
        bio: true,
        travelVibes: true,
        favoriteCategories: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            followers: true,
            following: true,
          },
        },
      },
    });

    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl ?? null,
      coverImageUrl: user.coverImageUrl ?? null,
      bio: user.bio ?? null,
      travelVibes: user.travelVibes,
      favoriteCategories: user.favoriteCategories,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      followerCount: user._count.followers,
      followingCount: user._count.following,
    };
  }

  async getPublicUser(viewerUserId: string | null, targetUserId: string) {
    const client = await this.prisma.getClient();
    const db = client as any;

    const user = await db.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        coverImageUrl: true,
        _count: { select: { followers: true, following: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let isFollowedByMe = false;
    if (viewerUserId) {
      const rows = await db.$queryRaw(Prisma.sql`
        SELECT 1 FROM "user_follows"
        WHERE "followerId" = ${viewerUserId}
          AND "followingId" = ${targetUserId}
        LIMIT 1
      `);
      isFollowedByMe = Array.isArray(rows) && rows.length > 0;
    }

    return {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      coverImageUrl: user.coverImageUrl ?? null,
      followerCount: user._count.followers,
      followingCount: user._count.following,
      isFollowedByMe,
    };
  }

  async followUser(currentUserId: string, targetUserId: string) {
    return this.setFollowState(currentUserId, targetUserId, true);
  }

  async unfollowUser(currentUserId: string, targetUserId: string) {
    return this.setFollowState(currentUserId, targetUserId, false);
  }

  private async setFollowState(
    currentUserId: string,
    targetUserId: string,
    shouldFollow: boolean,
  ) {
    if (currentUserId === targetUserId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const client = await this.prisma.getClient();
    const db = client as any;

    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        displayName: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (shouldFollow) {
      await db.$executeRaw(Prisma.sql`
        INSERT INTO "user_follows" ("id", "followerId", "followingId", "createdAt")
        VALUES (${randomUUID()}, ${currentUserId}, ${targetUserId}, NOW())
        ON CONFLICT ("followerId", "followingId") DO NOTHING
      `);
    } else {
      await db.$executeRaw(Prisma.sql`
        DELETE FROM "user_follows"
        WHERE "followerId" = ${currentUserId}
          AND "followingId" = ${targetUserId}
      `);
    }

    const followerCount = await this.getFollowerCount(db, targetUserId);

    return {
      creator: {
        id: targetUser.id,
        displayName: targetUser.displayName ?? null,
        isFollowedByMe: shouldFollow,
        followerCount,
      },
    };
  }

  async getFollowers(viewerUserId: string | null, targetUserId: string) {
    const client = await this.prisma.getClient();
    const db = client as any;

    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const viewerId = viewerUserId ?? '';

    const rows = (await db.$queryRaw(Prisma.sql`
      SELECT
        u."id",
        u."displayName",
        u."avatarUrl",
        CASE WHEN vf."id" IS NOT NULL THEN TRUE ELSE FALSE END AS "isFollowedByMe"
      FROM "user_follows" uf
      JOIN "users" u ON u."id" = uf."followerId"
      LEFT JOIN "user_follows" vf
        ON vf."followerId" = ${viewerId}
        AND vf."followingId" = u."id"
      WHERE uf."followingId" = ${targetUserId}
      ORDER BY uf."createdAt" DESC
    `)) as Array<{ id: string; displayName: string | null; avatarUrl: string | null; isFollowedByMe: boolean }>;

    return rows.map((r) => ({ ...r, isFollowedByMe: Boolean(r.isFollowedByMe) }));
  }

  async getFollowing(viewerUserId: string | null, targetUserId: string) {
    const client = await this.prisma.getClient();
    const db = client as any;

    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const viewerId = viewerUserId ?? '';

    const rows = (await db.$queryRaw(Prisma.sql`
      SELECT
        u."id",
        u."displayName",
        u."avatarUrl",
        CASE WHEN vf."id" IS NOT NULL THEN TRUE ELSE FALSE END AS "isFollowedByMe"
      FROM "user_follows" uf
      JOIN "users" u ON u."id" = uf."followingId"
      LEFT JOIN "user_follows" vf
        ON vf."followerId" = ${viewerId}
        AND vf."followingId" = u."id"
      WHERE uf."followerId" = ${targetUserId}
      ORDER BY uf."createdAt" DESC
    `)) as Array<{ id: string; displayName: string | null; avatarUrl: string | null; isFollowedByMe: boolean }>;

    return rows.map((r) => ({ ...r, isFollowedByMe: Boolean(r.isFollowedByMe) }));
  }

  async removeFollower(currentUserId: string, followerUserId: string) {
    const client = await this.prisma.getClient();
    const db = client as any;

    const followerUser = await db.user.findUnique({
      where: { id: followerUserId },
      select: { id: true },
    });

    if (!followerUser) {
      throw new NotFoundException('User not found');
    }

    await db.$executeRaw(Prisma.sql`
      DELETE FROM "user_follows"
      WHERE "followerId" = ${followerUserId}
        AND "followingId" = ${currentUserId}
    `);

    const followerCount = await this.getFollowerCount(db, currentUserId);

    return { followerCount };
  }

  async searchUsers(viewerUserId: string | null, q: string, limit = 20) {
    const query = q.trim();
    if (!query) return [];

    const client = await this.prisma.getClient();
    const db = client as any;
    const viewerId = viewerUserId ?? '';
    const pattern = `%${query}%`;

    const rows = (await db.$queryRaw(Prisma.sql`
      SELECT
        u."id",
        u."displayName",
        u."avatarUrl",
        (SELECT COUNT(*)::int FROM "user_follows" WHERE "followingId" = u."id") AS "followerCount",
        CASE WHEN vf."id" IS NOT NULL THEN TRUE ELSE FALSE END AS "isFollowedByMe"
      FROM "users" u
      LEFT JOIN "user_follows" vf
        ON vf."followerId" = ${viewerId}
        AND vf."followingId" = u."id"
      WHERE u."displayName" ILIKE ${pattern}
      ORDER BY "followerCount" DESC, u."displayName" ASC
      LIMIT ${limit}
    `)) as Array<{
      id: string;
      displayName: string | null;
      avatarUrl: string | null;
      followerCount: number;
      isFollowedByMe: boolean;
    }>;

    return rows.map((r) => ({
      id: r.id,
      displayName: r.displayName ?? null,
      avatarUrl: r.avatarUrl ?? null,
      followerCount: Number(r.followerCount),
      isFollowedByMe: Boolean(r.isFollowedByMe),
    }));
  }

  private async getFollowerCount(client: any, userId: string) {
    const rows = (await client.$queryRaw(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "user_follows"
      WHERE "followingId" = ${userId}
    `)) as Array<{ count: number }>;

    return rows[0]?.count ?? 0;
  }
}
