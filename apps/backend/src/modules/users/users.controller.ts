import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
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
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { type AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreatorFollowResponseDto } from './dto/creator-follow-response.dto';
import { CurrentUserResponseDto } from './dto/current-user-response.dto';
import { UsersService } from './users.service';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

type MaybeAuthenticatedRequest = Request & {
  user?: AuthenticatedUser | null;
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

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get public user profile',
    description: 'Returns a public user profile. isFollowedByMe requires a valid Bearer token.',
  })
  @ApiOkResponse({ description: 'Public user profile.' })
  @ApiNotFoundResponse({ description: 'User not found.' })
  async getPublicUser(
    @Req() req: MaybeAuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.usersService.getPublicUser(req.user?.id ?? null, id);
  }

  @Post(':id/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Follow a creator',
    description: 'Creates or preserves a follow relationship from the current user to the target creator.',
  })
  @ApiOkResponse({
    description: 'Follow state returned successfully.',
    type: CreatorFollowResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired Bearer token.' })
  @ApiNotFoundResponse({ description: 'Target user not found.' })
  async followUser(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.usersService.followUser(req.user.id, id);
  }

  @Delete(':id/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Unfollow a creator',
    description:
      'Removes a follow relationship from the current user to the target creator when it exists.',
  })
  @ApiOkResponse({
    description: 'Follow state returned successfully.',
    type: CreatorFollowResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired Bearer token.' })
  @ApiNotFoundResponse({ description: 'Target user not found.' })
  async unfollowUser(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.usersService.unfollowUser(req.user.id, id);
  }
}
