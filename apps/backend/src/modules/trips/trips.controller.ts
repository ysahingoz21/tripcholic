import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { type AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateTripDto } from './dto/create-trip.dto';
import { ExploreTripsQueryDto } from './dto/explore-trips-query.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { TripsService } from './trips.service';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

type MaybeAuthenticatedRequest = Request & {
  user?: AuthenticatedUser | null;
};

@ApiTags('trips')
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get('explore')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'List discoverable public trips for Explore' })
  @ApiOkResponse({ description: 'Explore trip list returned successfully.' })
  findExplore(@Req() req: MaybeAuthenticatedRequest, @Query() query: ExploreTripsQueryDto) {
    const userId = req.user?.id ?? null;
    return this.tripsService.findExploreTrips(query, userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create a trip' })
  @ApiBody({ type: CreateTripDto })
  @ApiOkResponse({ description: 'Trip created successfully.' })
  create(@Req() req: AuthenticatedRequest, @Body() body: CreateTripDto) {
    return this.tripsService.create(req.user.id, body);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List trips' })
  @ApiOkResponse({ description: 'Trip list returned successfully.' })
  findAll(@Req() req: AuthenticatedRequest) {
    return this.tripsService.findAll(req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get a single trip' })
  @ApiOkResponse({ description: 'Trip detail returned successfully.' })
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.tripsService.findOne(req.user.id, id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update a trip' })
  @ApiBody({ type: UpdateTripDto })
  @ApiOkResponse({ description: 'Trip updated successfully.' })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateTripDto,
  ) {
    return this.tripsService.update(req.user.id, id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Delete a trip' })
  @ApiOkResponse({ description: 'Trip deleted successfully.' })
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.tripsService.remove(req.user.id, id);
  }

  @Post(':id/optimize')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Optimize a trip',
    description:
      'Selects candidate POIs from the database based on the trip\'s categories and preferences, ' +
      'calls the optimizer microservice, and saves the resulting stops back to the trip.',
  })
  @ApiOkResponse({ description: 'Trip optimized successfully.' })
  optimize(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.tripsService.optimize(req.user.id, id);
  }
}
