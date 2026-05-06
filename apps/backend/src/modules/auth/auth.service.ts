import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { type JwtAccessTokenPayload } from './types/authenticated-user.type';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(payload: RegisterDto) {
    this.logger.log(
      `[AUTH_DEBUG] register service entry email=${payload.email} passwordLength=${payload.password?.length ?? 0}`,
    );
    this.logger.log(`[AUTH_DEBUG] register requesting Prisma client`);
    const client = await this.prisma.getClient();
    this.logger.log(`[AUTH_DEBUG] register Prisma client ready`);

    this.logger.log(
      `[AUTH_DEBUG] register before user.findUnique email=${payload.email}`,
    );
    const existing = await client.user.findUnique({
      where: { email: payload.email },
      select: { id: true },
    });
    this.logger.log(
      `[AUTH_DEBUG] register after user.findUnique email=${payload.email} exists=${Boolean(existing)}`,
    );

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    this.logger.log(
      `[AUTH_DEBUG] register before password hash rounds=${BCRYPT_ROUNDS} email=${payload.email}`,
    );
    const passwordHash = await hash(payload.password, BCRYPT_ROUNDS);
    this.logger.log(
      `[AUTH_DEBUG] register after password hash email=${payload.email} hashLength=${passwordHash.length}`,
    );

    this.logger.log(
      `[AUTH_DEBUG] register before user.create email=${payload.email}`,
    );
    const user = await client.user.create({
      data: {
        email: payload.email,
        passwordHash,
        displayName: payload.displayName?.trim() || null,
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        createdAt: true,
      },
    });
    this.logger.log(
      `[AUTH_DEBUG] register after user.create userId=${user.id} email=${user.email}`,
    );

    return {
      message: 'User registered successfully',
      user,
    };
  }

  async login(payload: LoginDto) {
    this.logger.log(
      `[AUTH_DEBUG] login service entry email=${payload.email} passwordLength=${payload.password?.length ?? 0}`,
    );
    this.logger.log(`[AUTH_DEBUG] login requesting Prisma client`);
    const client = await this.prisma.getClient();
    this.logger.log(`[AUTH_DEBUG] login Prisma client ready`);

    this.logger.log(
      `[AUTH_DEBUG] login before user.findUnique email=${payload.email}`,
    );
    const user = await client.user.findUnique({
      where: { email: payload.email },
      select: {
        id: true,
        displayName: true,
        email: true,
        passwordHash: true,
        createdAt: true,
      },
    });
    this.logger.log(
      `[AUTH_DEBUG] login after user.findUnique email=${payload.email} found=${Boolean(user)}`,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(
      `[AUTH_DEBUG] login before password compare email=${payload.email} storedHashLength=${user.passwordHash.length}`,
    );
    const isPasswordValid = await compare(payload.password, user.passwordHash);
    this.logger.log(
      `[AUTH_DEBUG] login after password compare email=${payload.email} isPasswordValid=${isPasswordValid}`,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokenPayload: JwtAccessTokenPayload = {
      sub: user.id,
      email: user.email,
    };

    this.logger.log(
      `[AUTH_DEBUG] login before jwt sign userId=${user.id} email=${user.email}`,
    );
    const accessToken = await this.jwtService.signAsync(tokenPayload);
    this.logger.log(
      `[AUTH_DEBUG] login after jwt sign userId=${user.id} tokenLength=${accessToken.length}`,
    );

    return {
      message: 'Login successful',
      accessToken,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        createdAt: user.createdAt,
      },
    };
  }
}
