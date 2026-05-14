import { Controller, Get } from '@nestjs/common';
import { WeatherService } from './weather.service';

@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get('istanbul')
  async getIstanbulWeather() {
    return this.weatherService.getIstanbulWeather();
  }
}