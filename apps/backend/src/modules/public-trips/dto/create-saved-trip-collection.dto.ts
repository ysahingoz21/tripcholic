import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSavedTripCollectionDto {
  @ApiProperty({
    example: 'Weekend ideas',
    description: 'Display name for the saved trip collection.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}
