import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const TRIP_CATEGORY_VALUES = [
  'historical',
  'scenic',
  'food',
  'shopping',
  'nature',
  'neighborhood',
  'entertainment',
  'culture',
  'history',
  'museums',
  'coffee',
  'nightlife',
] as const;

export const WEATHER_VALUES = ['clear', 'cloudy', 'rainy'] as const;
export const TRIP_VISIBILITY_VALUES = ['DRAFT', 'PRIVATE', 'PUBLIC'] as const;

export class CreateTripDto {
  @ApiProperty({ example: 'Historic Istanbul Day' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({ example: 'A culture-heavy single-day route.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: '2026-04-08' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime?: string;

  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime?: string;

  @ApiPropertyOptional({
    enum: TRIP_CATEGORY_VALUES,
    isArray: true,
    example: ['culture', 'food'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(TRIP_CATEGORY_VALUES, { each: true })
  categories?: Array<(typeof TRIP_CATEGORY_VALUES)[number]>;

  @ApiPropertyOptional({ example: 3000 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  budgetTl?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  maxWalkingDistanceKm?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxStops?: number;

  @ApiPropertyOptional({ enum: WEATHER_VALUES, example: 'clear' })
  @IsOptional()
  @IsIn(WEATHER_VALUES)
  weather?: (typeof WEATHER_VALUES)[number];

  @ApiPropertyOptional({ enum: TRIP_VISIBILITY_VALUES, example: 'DRAFT' })
  @IsOptional()
  @IsIn(TRIP_VISIBILITY_VALUES)
  visibility?: (typeof TRIP_VISIBILITY_VALUES)[number];
}
