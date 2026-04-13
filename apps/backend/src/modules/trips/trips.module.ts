import { Module } from '@nestjs/common';
import { OptimizerModule } from '../optimizer/optimizer.module';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [OptimizerModule],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
