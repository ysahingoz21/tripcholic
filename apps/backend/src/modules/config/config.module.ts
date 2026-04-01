import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { appConfig } from './app.config';
import { validateEnv } from './env.validation';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [appConfig],
      validate: validateEnv,
    }),
  ],
})
export class ConfigModule {}
