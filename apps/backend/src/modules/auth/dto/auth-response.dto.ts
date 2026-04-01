import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({ example: '9f3c9d61-65df-4c3e-9ff3-4f5bdb1a7f8a' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: '2026-04-01T10:15:30.000Z' })
  createdAt!: string;
}

export class RegisterResponseDto {
  @ApiProperty({ example: 'User registered successfully' })
  message!: string;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}

export class LoginResponseDto {
  @ApiProperty({ example: 'Login successful' })
  message!: string;

  @ApiProperty({
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWlkIiwiZW1haWwiOiJ1c2VyQGV4YW1wbGUuY29tIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMDM2MDB9.signature',
  })
  accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}
