import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TRIP_VISIBILITY_VALUES } from './create-trip.dto';

export class ManualTripStopDto {
  @ApiProperty({ example: 'poi-uuid-here' })
  @IsString()
  poiId!: string;

  @ApiProperty({ example: '10:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  arrivalTime!: string;

  @ApiProperty({ example: '11:30' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  departureTime!: string;
}

export class CreateManualTripDto {
  @ApiProperty({ example: 'My Istanbul Day' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime?: string;

  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime?: string;

  @ApiPropertyOptional({ enum: TRIP_VISIBILITY_VALUES, example: 'PRIVATE' })
  @IsOptional()
  @IsIn(TRIP_VISIBILITY_VALUES)
  visibility?: (typeof TRIP_VISIBILITY_VALUES)[number];

  @ApiProperty({ type: [ManualTripStopDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ManualTripStopDto)
  stops!: ManualTripStopDto[];
}
