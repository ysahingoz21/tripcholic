import { API_BASE_URL } from '@/constants/api';

export type WeatherSummary = {
  city: string;
  temperature: number;
  precipitation: number;
  precipitationProbability: number;
  weatherCode: number;
  condition: string;
  isOutdoorFriendly: boolean;
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
};

export async function getIstanbulWeather(): Promise<WeatherSummary> {
  const response = await fetch(`${API_BASE_URL}/weather/istanbul`);

  if (!response.ok) {
    throw new Error('Failed to fetch weather data');
  }

  const result = await response.json();

  return result.data;
}