import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { TripsService } from './trips.service';

@ApiTags('trips')
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a trip placeholder endpoint' })
  @ApiBody({ type: CreateTripDto })
  @ApiOkResponse({ description: 'Temporary trip creation response.' })
  create(@Body() body: CreateTripDto) {
    return this.tripsService.create(body);
  }

  @Get()
  @ApiOperation({ summary: 'List trips placeholder endpoint' })
  @ApiOkResponse({ description: 'Temporary trip list response.' })
  findAll() {
    return this.tripsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get trip placeholder endpoint' })
  @ApiOkResponse({ description: 'Temporary trip detail response.' })
  findOne(@Param('id') id: string) {
    return this.tripsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update trip placeholder endpoint' })
  @ApiBody({ type: UpdateTripDto })
  @ApiOkResponse({ description: 'Temporary trip update response.' })
  update(@Param('id') id: string, @Body() body: UpdateTripDto) {
    return this.tripsService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete trip placeholder endpoint' })
  @ApiOkResponse({ description: 'Temporary trip delete response.' })
  remove(@Param('id') id: string) {
    return this.tripsService.remove(id);
  }
}
