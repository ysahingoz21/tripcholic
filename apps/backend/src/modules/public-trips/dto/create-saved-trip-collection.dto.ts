import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateSavedTripCollectionDto {
  @ApiProperty({
    example: 'Weekend ideas',
    description: 'Display name for the saved trip collection.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/demo/image/upload/v1/collections/abc.jpg' })
  @IsOptional()
  @IsString()
  @IsUrl()
  @MaxLength(2048)
  coverImageUrl?: string | null;
}
