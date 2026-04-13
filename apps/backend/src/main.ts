import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { type AppConfig } from './modules/config/app.config';

const DEVELOPMENT_ALLOWED_ORIGINS = new Set([
  'http://localhost:8081',
  'http://localhost:19006',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19006',
]);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const config = configService.getOrThrow<AppConfig>('app', {
    infer: true,
  });
  const configuredOrigins = new Set(
    config.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
  );

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isConfiguredOrigin = configuredOrigins.has(origin);
      const isDevelopmentOrigin =
        config.NODE_ENV === 'development' &&
        DEVELOPMENT_ALLOWED_ORIGINS.has(origin);

      callback(null, isConfiguredOrigin || isDevelopmentOrigin);
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Tripcholic Backend API')
    .setDescription('Central orchestration API for mobile clients and the optimizer service.')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste the JWT access token returned by /api/auth/login.',
      },
      'bearer',
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(config.PORT, '0.0.0.0');
}

void bootstrap();
