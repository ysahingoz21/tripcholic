import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PublicTripsController } from './public-trips.controller';
import { PublicTripsService } from './public-trips.service';

@Module({
  imports: [AuthModule],
  controllers: [PublicTripsController],
  providers: [PublicTripsService],
})
export class PublicTripsModule {}
