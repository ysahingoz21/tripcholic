import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class UpdateSavedTripCollectionsDto {
  @ApiProperty({
    type: [String],
    example: ['collection-id-1', 'collection-id-2'],
    description:
      'Full replacement list of saved trip collection ids for the saved trip.',
  })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  collectionIds!: string[];
}
