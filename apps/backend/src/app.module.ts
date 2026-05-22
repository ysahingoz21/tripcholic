import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { CommonModule } from './modules/common/common.module';
import { ConfigModule } from './modules/config/config.module';
import { HealthModule } from './modules/health/health.module';
import { OptimizerModule } from './modules/optimizer/optimizer.module';
import { PoisModule } from './modules/pois/pois.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { PublicTripsModule } from './modules/public-trips/public-trips.module';
import { TripsModule } from './modules/trips/trips.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { UsersModule } from './modules/users/users.module';
import { WeatherModule } from './modules/weather/weather.module';

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    TripsModule,
    PublicTripsModule,
    PoisModule,
    OptimizerModule,
    WeatherModule,
    UploadsModule,
  ],
})
export class AppModule {}