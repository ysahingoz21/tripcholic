import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { OptimizerPreviewRequestDto } from './dto/optimizer-preview.dto';
import { OptimizerService } from './optimizer.service';

@ApiTags('optimizer')
@Controller('optimizer')
export class OptimizerController {
  constructor(private readonly optimizerService: OptimizerService) {}

  @Get('health')
  @ApiOperation({ summary: 'Check optimizer microservice health through the backend' })
  @ApiOkResponse({ description: 'Optimizer health fetched by backend.' })
  getHealth() {
    return this.optimizerService.getOptimizerHealth();
  }

  @Post('preview')
  @ApiOperation({
    summary:
      'Preview a generated route by mapping backend-friendly input into the optimizer contract',
  })
  @ApiBody({ type: OptimizerPreviewRequestDto })
  @ApiOkResponse({ description: 'Optimizer preview generated successfully.' })
  preview(@Body() body: OptimizerPreviewRequestDto) {
    return this.optimizerService.previewRoute(body);
  }
}
