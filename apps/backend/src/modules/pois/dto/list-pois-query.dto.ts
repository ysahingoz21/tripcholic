import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const POI_CATEGORY_VALUES = [
  'historical',
  'scenic',
  'food',
  'shopping',
  'nature',
  'neighborhood',
  'entertainment',
] as const;

export class ListPoisQueryDto {
  @ApiPropertyOptional({ enum: POI_CATEGORY_VALUES, example: 'historical' })
  @IsOptional()
  @IsIn(POI_CATEGORY_VALUES)
  category?: (typeof POI_CATEGORY_VALUES)[number];

  @ApiPropertyOptional({ example: 'galata' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
