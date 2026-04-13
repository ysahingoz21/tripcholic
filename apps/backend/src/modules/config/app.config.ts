import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 3000),
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  JWT_SECRET: process.env.JWT_SECRET ?? '',
  OPTIMIZER_URL: process.env.OPTIMIZER_URL ?? '',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:19006',
}));

export type AppConfig = ReturnType<typeof appConfig>;
