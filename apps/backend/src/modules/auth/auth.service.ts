import { Injectable } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  register(payload: RegisterDto) {
    return {
      status: 'pending_implementation' as const,
      message:
        'Registration endpoint is validated and ready, but user persistence and password hashing will be added after Prisma business models are finalized.',
      submitted: {
        email: payload.email,
        displayName: payload.displayName ?? null,
      },
      nextStep: 'Finalize user schema and auth persistence flow.',
    };
  }

  login(payload: LoginDto) {
    return {
      status: 'pending_implementation' as const,
      message:
        'Login endpoint is validated and ready, but credential verification and token issuing will be added after Prisma business models are finalized.',
      submitted: {
        email: payload.email,
      },
      nextStep: 'Finalize user schema, password verification, and JWT issuing flow.',
    };
  }
}
