import { ApiProperty } from '@nestjs/swagger';

export class CurrentUserResponseDto {
  @ApiProperty({ example: '9f3c9d61-65df-4c3e-9ff3-4f5bdb1a7f8a' })
  id!: string;

  @ApiProperty({ example: 'Tripcholic User', required: false, nullable: true })
  displayName!: string | null;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: '2026-04-01T10:15:30.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-04-01T10:15:30.000Z' })
  updatedAt!: string;
}
