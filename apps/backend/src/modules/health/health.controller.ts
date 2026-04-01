import { Controller, Get } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

class HealthResponseDto {
  status!: 'ok';
  service!: string;
  timestamp!: string;
}

class HealthSuccessResponseDto {
  success!: true;
  data!: HealthResponseDto;
}

@ApiTags('health')
@ApiExtraModels(HealthResponseDto, HealthSuccessResponseDto)
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Backend health check' })
  @ApiOkResponse({
    description: 'Service health status.',
    type: HealthSuccessResponseDto,
  })
  getHealth(): HealthResponseDto {
    return this.healthService.getHealth();
  }
}
