import { ApiProperty } from '@nestjs/swagger';

class CreatorFollowDto {
  @ApiProperty({ example: '9f3c9d61-65df-4c3e-9ff3-4f5bdb1a7f8a' })
  id!: string;

  @ApiProperty({ example: 'Alice', required: false, nullable: true })
  displayName!: string | null;

  @ApiProperty({ example: true })
  isFollowedByMe!: boolean;

  @ApiProperty({ example: 12 })
  followerCount!: number;
}

export class CreatorFollowResponseDto {
  @ApiProperty({ type: CreatorFollowDto })
  creator!: CreatorFollowDto;
}
