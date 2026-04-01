import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ListPoisQueryDto } from './dto/list-pois-query.dto';
import { PoisService } from './pois.service';

@ApiTags('pois')
@Controller('pois')
export class PoisController {
  constructor(private readonly poisService: PoisService) {}

  @Get()
  @ApiOperation({
    summary: 'List POIs from the database',
  })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({ description: 'Database-backed POI list response.' })
  findAll(@Query() query: ListPoisQueryDto) {
    return this.poisService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single POI from the database',
  })
  @ApiOkResponse({ description: 'Database-backed POI detail response.' })
  findOne(@Param('id') id: string) {
    return this.poisService.findOne(id);
  }
}
