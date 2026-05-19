import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class UpdateTripFeedbackDto {
  @ApiProperty({
    type: [String],
    example: ['worked_well', 'worth_repeating'],
    description:
      'Full replacement list of structured post-completion feedback signals for this public trip.',
  })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  signals!: string[];
}
