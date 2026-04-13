import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { TripsService } from './trips.service';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@ApiTags('trips')
@Controller('trips')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a trip' })
  @ApiBody({ type: CreateTripDto })
  @ApiOkResponse({ description: 'Trip created successfully.' })
  create(@Req() req: AuthenticatedRequest, @Body() body: CreateTripDto) {
    return this.tripsService.create(req.user.id, body);
  }

  @Get()
  @ApiOperation({ summary: 'List trips' })
  @ApiOkResponse({ description: 'Trip list returned successfully.' })
  findAll(@Req() req: AuthenticatedRequest) {
    return this.tripsService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single trip' })
  @ApiOkResponse({ description: 'Trip detail returned successfully.' })
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.tripsService.findOne(req.user.id, id);
  }

  @Patch(':id')
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
  @ApiOperation({ summary: 'Delete a trip' })
  @ApiOkResponse({ description: 'Trip deleted successfully.' })
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.tripsService.remove(req.user.id, id);
  }

  @Post(':id/optimize')
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
