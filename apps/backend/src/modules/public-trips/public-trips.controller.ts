import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { type Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { type AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateSavedTripCollectionDto } from './dto/create-saved-trip-collection.dto';
import { RenameSavedTripCollectionDto } from './dto/rename-saved-trip-collection.dto';
import { CreateTripCommentDto } from './dto/create-trip-comment.dto';
import { ListForYouTripsQueryDto } from './dto/list-for-you-trips-query.dto';
import { ListSavedTripsQueryDto } from './dto/list-saved-trips-query.dto';
import { UpdateTripFeedbackDto } from './dto/update-trip-feedback.dto';
import { UpdateSavedTripCollectionsDto } from './dto/update-saved-trip-collections.dto';
import { PublicTripsService } from './public-trips.service';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@ApiTags('public-trips')
@Controller('public-trips')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class PublicTripsController {
  constructor(private readonly publicTripsService: PublicTripsService) {}

  @Get('saved')
  @ApiOperation({ summary: 'List saved public trips for the current user' })
  @ApiOkResponse({ description: 'Saved public trips returned successfully.' })
  findSaved(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListSavedTripsQueryDto,
  ) {
    return this.publicTripsService.findSavedTrips(req.user.id, query);
  }

  @Get('for-you')
  @ApiOperation({ summary: 'List personalized public trips for the current user' })
  @ApiOkResponse({ description: 'Personalized public trips returned successfully.' })
  findForYou(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListForYouTripsQueryDto,
  ) {
    return this.publicTripsService.findForYouTrips(req.user.id, query);
  }

  @Post('saved/collections')
  @ApiOperation({ summary: 'Create a saved trip collection for the current user' })
  @ApiBody({ type: CreateSavedTripCollectionDto })
  @ApiOkResponse({ description: 'Saved trip collection created successfully.' })
  createCollection(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateSavedTripCollectionDto,
  ) {
    return this.publicTripsService.createSavedTripCollection(req.user.id, body);
  }

  @Put('saved/:savedTripId/collections')
  @ApiOperation({ summary: 'Replace collection memberships for a saved public trip' })
  @ApiBody({ type: UpdateSavedTripCollectionsDto })
  @ApiOkResponse({
    description: 'Saved trip collection memberships updated successfully.',
  })
  replaceSavedTripCollections(
    @Req() req: AuthenticatedRequest,
    @Param('savedTripId') savedTripId: string,
    @Body() body: UpdateSavedTripCollectionsDto,
  ) {
    return this.publicTripsService.replaceSavedTripCollections(
      req.user.id,
      savedTripId,
      body,
    );
  }

  @Patch('saved/collections/:collectionId')
  @ApiOperation({ summary: 'Rename a saved trip collection for the current user' })
  @ApiBody({ type: RenameSavedTripCollectionDto })
  @ApiOkResponse({ description: 'Saved trip collection renamed successfully.' })
  renameCollection(
    @Req() req: AuthenticatedRequest,
    @Param('collectionId') collectionId: string,
    @Body() body: RenameSavedTripCollectionDto,
  ) {
    return this.publicTripsService.renameSavedTripCollection(req.user.id, collectionId, body);
  }

  @Delete('saved/collections/:collectionId')
  @ApiOperation({ summary: 'Delete a saved trip collection for the current user' })
  @ApiOkResponse({ description: 'Saved trip collection deleted successfully.' })
  deleteCollection(
    @Req() req: AuthenticatedRequest,
    @Param('collectionId') collectionId: string,
  ) {
    return this.publicTripsService.deleteSavedTripCollection(req.user.id, collectionId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a public trip post detail' })
  @ApiOkResponse({ description: 'Public trip detail returned successfully.' })
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.publicTripsService.findOne(req.user.id, id);
  }

  @Post(':id/remix')
  @ApiOperation({ summary: 'Create a new owned trip by remixing a public trip post' })
  @ApiOkResponse({ description: 'Public trip remixed successfully.' })
  remix(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.publicTripsService.remixTrip(req.user.id, id);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Mark a public trip post as completed' })
  @ApiOkResponse({ description: 'Public trip marked as completed successfully.' })
  complete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.publicTripsService.completeTrip(req.user.id, id);
  }

  @Delete(':id/complete')
  @ApiOperation({ summary: 'Remove a completion mark from a public trip post' })
  @ApiOkResponse({
    description: 'Public trip completion mark removed successfully.',
  })
  uncomplete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.publicTripsService.uncompleteTrip(req.user.id, id);
  }

  @Put(':id/feedback')
  @ApiOperation({ summary: 'Replace structured feedback for a completed public trip post' })
  @ApiBody({ type: UpdateTripFeedbackDto })
  @ApiOkResponse({
    description: 'Public trip feedback updated successfully.',
  })
  updateFeedback(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateTripFeedbackDto,
  ) {
    return this.publicTripsService.updateTripFeedback(req.user.id, id, body);
  }

  @Post(':id/likes')
  @ApiOperation({ summary: 'Like a public trip post' })
  @ApiOkResponse({ description: 'Public trip liked successfully.' })
  like(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.publicTripsService.likeTrip(req.user.id, id);
  }

  @Delete(':id/likes')
  @ApiOperation({ summary: 'Remove a like from a public trip post' })
  @ApiOkResponse({ description: 'Public trip unliked successfully.' })
  unlike(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.publicTripsService.unlikeTrip(req.user.id, id);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'List comments for a public trip post' })
  @ApiOkResponse({ description: 'Public trip comments returned successfully.' })
  listComments(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.publicTripsService.listComments(req.user.id, id);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Create a comment on a public trip post' })
  @ApiBody({ type: CreateTripCommentDto })
  @ApiOkResponse({ description: 'Public trip comment created successfully.' })
  createComment(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: CreateTripCommentDto,
  ) {
    return this.publicTripsService.createComment(req.user.id, id, body);
  }

  @Post(':id/save')
  @ApiOperation({ summary: 'Save a public trip post' })
  @ApiOkResponse({ description: 'Public trip saved successfully.' })
  save(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.publicTripsService.saveTrip(req.user.id, id);
  }

  @Delete(':id/save')
  @ApiOperation({ summary: 'Remove a saved public trip post' })
  @ApiOkResponse({ description: 'Public trip unsaved successfully.' })
  unsave(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.publicTripsService.unsaveTrip(req.user.id, id);
  }
}
