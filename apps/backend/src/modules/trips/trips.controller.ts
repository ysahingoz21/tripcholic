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
  @ApiOperation({ summary: 'Create a trip' })
  @ApiBody({ type: CreateTripDto })
  @ApiOkResponse({ description: 'Trip created successfully.' })
  create(@Body() body: CreateTripDto) {
    return this.tripsService.create(body);
  }

  @Get()
  @ApiOperation({ summary: 'List trips' })
  @ApiOkResponse({ description: 'Trip list returned successfully.' })
  findAll() {
    return this.tripsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single trip' })
  @ApiOkResponse({ description: 'Trip detail returned successfully.' })
  findOne(@Param('id') id: string) {
    return this.tripsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a trip' })
  @ApiBody({ type: UpdateTripDto })
  @ApiOkResponse({ description: 'Trip updated successfully.' })
  update(@Param('id') id: string, @Body() body: UpdateTripDto) {
    return this.tripsService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a trip' })
  @ApiOkResponse({ description: 'Trip deleted successfully.' })
  remove(@Param('id') id: string) {
    return this.tripsService.remove(id);
  }
}
