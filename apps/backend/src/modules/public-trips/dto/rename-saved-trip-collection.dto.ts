import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RenameSavedTripCollectionDto {
  @ApiProperty({
    example: 'Weekend in Istanbul',
    description: 'New display name for the saved trip collection.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}
