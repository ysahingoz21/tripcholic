import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TRIP_CATEGORY_VALUES, WEATHER_VALUES } from './create-trip.dto';

export class ExploreTripsQueryDto {
  @ApiPropertyOptional({
    example: 'coffee',
    description: 'Case-insensitive keyword search across title, description, route name, and creator display name.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({
    enum: TRIP_CATEGORY_VALUES,
    example: 'food',
  })
  @IsOptional()
  @IsIn(TRIP_CATEGORY_VALUES)
  category?: (typeof TRIP_CATEGORY_VALUES)[number];

  @ApiPropertyOptional({ example: 2000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetMinTl?: number;

  @ApiPropertyOptional({ example: 6000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetMaxTl?: number;

  @ApiPropertyOptional({
    enum: WEATHER_VALUES,
    example: 'rainy',
  })
  @IsOptional()
  @IsIn(WEATHER_VALUES)
  weather?: (typeof WEATHER_VALUES)[number];

  @ApiPropertyOptional({
    example: 20,
    description: 'Maximum number of discoverable trips to return.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
