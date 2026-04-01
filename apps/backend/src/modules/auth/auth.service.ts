import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(payload: RegisterDto) {
    const client = await this.prisma.getClient();

    const existing = await client.user.findUnique({
      where: { email: payload.email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await hash(payload.password, BCRYPT_ROUNDS);

    const user = await client.user.create({
      data: {
        email: payload.email,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    return {
      message: 'User registered successfully',
      user,
    };
  }

  login(_payload: LoginDto) {
    // Credential verification and JWT issuing will be added in a follow-up step.
    throw new UnauthorizedException('Login not yet implemented');
  }
}
