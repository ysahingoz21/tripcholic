import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { CreateTripDto } from './create-trip.dto';

export class UpdateTripDto extends PartialType(CreateTripDto) {
  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/demo/image/upload/v1/trips/abc123.jpg' })
  @IsOptional()
  @IsString()
  @IsUrl()
  @MaxLength(2048)
  coverImageUrl?: string | null;
}
