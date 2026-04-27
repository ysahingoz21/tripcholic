import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTripCommentDto {
  @ApiProperty({
    example: 'Love the pacing on this route.',
    description: 'Comment body for a public trip post.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body!: string;
}
