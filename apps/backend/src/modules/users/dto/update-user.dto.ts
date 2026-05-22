import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ example: 'Yusuf', required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string | null;

  @ApiProperty({ example: 'Coffee enthusiast exploring hidden gems.', required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  bio?: string | null;

  @ApiProperty({ example: 'https://res.cloudinary.com/...', required: false, nullable: true })
  @IsOptional()
  @IsString()
  avatarUrl?: string | null;

  @ApiProperty({ example: 'https://res.cloudinary.com/...', required: false, nullable: true })
  @IsOptional()
  @IsString()
  coverImageUrl?: string | null;

  @ApiProperty({ example: ['Food Hunter', 'Night Owl'], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  travelVibes?: string[];

  @ApiProperty({ example: ['FOOD', 'HISTORICAL'], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  favoriteCategories?: string[];
}
