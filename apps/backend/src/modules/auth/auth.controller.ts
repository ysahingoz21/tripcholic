import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
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
  })
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  @ApiOperation({
    summary: 'Temporary login endpoint scaffold',
    description:
      'Validates login input and returns a temporary response until credential verification and JWT issuing are implemented.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Temporary login response.',
  })
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }
}
