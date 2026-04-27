import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListSavedTripsQueryDto {
  @ApiPropertyOptional({
    example: 'ungrouped',
    description:
      'Optional saved-trip grouping filter. Pass a saved trip collection id or the literal value "ungrouped".',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  collectionId?: string;
}
