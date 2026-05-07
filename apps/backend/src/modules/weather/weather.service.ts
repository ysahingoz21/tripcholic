import { Injectable } from '@nestjs/common';

type WeatherCondition = {
  condition: string;
  isOutdoorFriendly: boolean;
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
};

@Injectable()
export class WeatherService {
  async getIstanbulWeather() {
    const response = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=41.0082&longitude=28.9784&current=temperature_2m,precipitation,weather_code&hourly=precipitation_probability&forecast_days=1',
    );

    const data = await response.json();

    const current = data.current;
    const precipitationProbability =
      data.hourly?.precipitation_probability?.[0] ?? 0;

    const weatherInfo = this.mapWeatherToSuggestion(
      current.weather_code,
      precipitationProbability,
    );

    return {
      city: 'Istanbul',
      temperature: current.temperature_2m,
      precipitation: current.precipitation,
      precipitationProbability,
      weatherCode: current.weather_code,
      condition: weatherInfo.condition,
      isOutdoorFriendly: weatherInfo.isOutdoorFriendly,
      severity: weatherInfo.severity,
      suggestion: weatherInfo.suggestion,
    };
  }

  private mapWeatherToSuggestion(
    weatherCode: number,
    precipitationProbability: number,
  ): WeatherCondition {
    if (precipitationProbability >= 70) {
      return {
        condition: 'Rainy',
        isOutdoorFriendly: false,
        severity: 'high',
        suggestion:
          'Rain is very likely today. Indoor attractions, museums, galleries, and cafes may be better choices.',
      };
    }

    if (precipitationProbability >= 40) {
      return {
        condition: 'Possible rain',
        isOutdoorFriendly: true,
        severity: 'medium',
        suggestion:
          'There is a chance of rain today. Consider keeping indoor alternatives in your plan.',
      };
    }

    if ([0, 1].includes(weatherCode)) {
      return {
        condition: 'Clear',
        isOutdoorFriendly: true,
        severity: 'low',
        suggestion:
          'Weather looks good for outdoor activities and walking routes.',
      };
    }

    if ([2, 3].includes(weatherCode)) {
      return {
        condition: 'Cloudy',
        isOutdoorFriendly: true,
        severity: 'low',
        suggestion:
          'Cloudy weather is suitable for a balanced indoor and outdoor route.',
      };
    }

    return {
      condition: 'Mixed weather',
      isOutdoorFriendly: true,
      severity: 'medium',
      suggestion:
        'Weather may vary today. A flexible route with indoor backup options is recommended.',
    };
  }
}