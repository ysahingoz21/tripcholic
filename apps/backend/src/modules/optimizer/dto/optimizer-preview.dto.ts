import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const BACKEND_CATEGORY_VALUES = [
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

const WEATHER_VALUES = ['clear', 'cloudy', 'rainy'] as const;
const BUDGET_LEVEL_VALUES = ['low', 'medium', 'high'] as const;

export class CoordinatesDto {
  @ApiProperty({ example: 41.0086 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ example: 28.9802 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}

export class OpeningHoursDto {
  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  open!: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  close!: string;
}

export class PricingDto {
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minTl?: number;

  @ApiPropertyOptional({ example: 2000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxTl?: number;

  @ApiPropertyOptional({ enum: BUDGET_LEVEL_VALUES, example: 'medium' })
  @IsOptional()
  @IsIn(BUDGET_LEVEL_VALUES)
  budgetLevel?: (typeof BUDGET_LEVEL_VALUES)[number];
}

export class PreviewCandidatePlaceDto {
  @ApiProperty({ example: 'poi-galata-tower' })
  @IsString()
  placeId!: string;

  @ApiProperty({ example: 'Galata Tower' })
  @IsString()
  title!: string;

  @ApiProperty({ enum: BACKEND_CATEGORY_VALUES, example: 'culture' })
  @IsString()
  @IsIn(BACKEND_CATEGORY_VALUES)
  category!: (typeof BACKEND_CATEGORY_VALUES)[number];

  @ApiProperty({ type: CoordinatesDto })
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates!: CoordinatesDto;

  @ApiProperty({ type: OpeningHoursDto })
  @ValidateNested()
  @Type(() => OpeningHoursDto)
  openingHours!: OpeningHoursDto;

  @ApiProperty({ type: PricingDto })
  @ValidateNested()
  @Type(() => PricingDto)
  pricing!: PricingDto;

  @ApiProperty({ example: 60 })
  @IsInt()
  @Min(1)
  @Max(480)
  suggestedVisitDurationMinutes!: number;
}

export class PreviewPreferencesDto {
  @ApiPropertyOptional({
    enum: BACKEND_CATEGORY_VALUES,
    isArray: true,
    example: ['culture', 'food'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsIn(BACKEND_CATEGORY_VALUES, { each: true })
  categories?: Array<(typeof BACKEND_CATEGORY_VALUES)[number]>;

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

  @ApiPropertyOptional({ example: 3000 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxBudgetTl?: number;

  @ApiPropertyOptional({ enum: BUDGET_LEVEL_VALUES, example: 'medium' })
  @IsOptional()
  @IsIn(BUDGET_LEVEL_VALUES)
  budgetLevel?: (typeof BUDGET_LEVEL_VALUES)[number];

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
}

export class OptimizerPreviewRequestDto {
  @ApiProperty({ example: 'preview-trip-001' })
  @IsString()
  previewId!: string;

  @ApiProperty({ example: '2026-04-05' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  tripDate!: string;

  @ApiProperty({ type: PreviewPreferencesDto })
  @ValidateNested()
  @Type(() => PreviewPreferencesDto)
  preferences!: PreviewPreferencesDto;

  @ApiProperty({ type: [PreviewCandidatePlaceDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PreviewCandidatePlaceDto)
  candidatePlaces!: PreviewCandidatePlaceDto[];
}
