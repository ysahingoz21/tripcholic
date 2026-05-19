import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
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

  private async getFollowerCount(client: any, userId: string) {
    const rows = (await client.$queryRaw(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "user_follows"
      WHERE "followingId" = ${userId}
    `)) as Array<{ count: number }>;

    return rows[0]?.count ?? 0;
  }
}
