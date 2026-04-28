import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListForYouTripsQueryDto {
  @ApiPropertyOptional({
    example: 20,
    description: 'Maximum number of personalized public trips to return.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
