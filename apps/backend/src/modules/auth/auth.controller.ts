import { Body, Controller, Logger, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginResponseDto, RegisterResponseDto } from './dto/auth-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Validates input, checks for duplicate email, hashes the password, and creates a user record in the database.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiOkResponse({
    description: 'User registration response.',
    type: RegisterResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @ApiConflictResponse({ description: 'An account with this email already exists.' })
  register(@Body() body: RegisterDto) {
    this.logger.log(
      `[AUTH_DEBUG] register controller entry email=${body.email} passwordLength=${body.password?.length ?? 0}`,
    );
    return this.authService.register(body);
  }

  @Post('login')
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'Validates login input, verifies credentials against the database, and returns a JWT Bearer access token.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Successful login response.',
    type: LoginResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  login(@Body() body: LoginDto) {
    this.logger.log(
      `[AUTH_DEBUG] login controller entry email=${body.email} passwordLength=${body.password?.length ?? 0}`,
    );
    return this.authService.login(body);
  }
}
