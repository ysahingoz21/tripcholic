import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { type AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CurrentUserResponseDto } from './dto/current-user-response.dto';
import { UsersService } from './users.service';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Get current user',
    description: 'Returns the authenticated user profile for the current access token.',
  })
  @ApiOkResponse({
    description: 'Current authenticated user.',
    type: CurrentUserResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired Bearer token.' })
  @ApiNotFoundResponse({ description: 'Authenticated user no longer exists.' })
  async getMe(@Req() req: AuthenticatedRequest) {
    return this.usersService.getCurrentUser(req.user.id);
  }
}
