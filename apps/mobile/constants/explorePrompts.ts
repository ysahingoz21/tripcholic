import type { ExploreTripsQuery, ExploreWeather } from '@/services/trips';

export type ExplorePromptId =
  | 'rainy-day'
  | 'sunny-day'
  | 'budget-weekend'
  | 'food-crawl'
  | 'coffee-stops'
  | 'nature-break'
  | 'shopping-day';

export type ExplorePromptDefinition = {
  id: ExplorePromptId;
  label: string;
  description: string;
  filters: Pick<ExploreTripsQuery, 'category' | 'budgetMinTl' | 'budgetMaxTl' | 'weather'>;
};

const rainyWeather: ExploreWeather = 'rainy';
const clearWeather: ExploreWeather = 'clear';

export const EXPLORE_PROMPTS: ExplorePromptDefinition[] = [
  {
    id: 'rainy-day',
    label: 'Rainy Day',
    description: 'Indoor-friendly discovery for rainy conditions.',
    filters: {
      weather: rainyWeather,
    },
  },
  {
    id: 'sunny-day',
    label: 'Sunny Day',
    description: 'Clear-weather trips for open-air exploring.',
    filters: {
      weather: clearWeather,
    },
  },
  {
    id: 'budget-weekend',
    label: 'Budget Weekend',
    description: 'Low-cost public trips capped at 2000 TL.',
    filters: {
      budgetMaxTl: 2000,
    },
  },
  {
    id: 'food-crawl',
    label: 'Food Crawl',
    description: 'Optimized public routes centered on food stops.',
    filters: {
      category: 'food',
    },
  },
  {
    id: 'coffee-stops',
    label: 'Coffee Stops',
    description: 'Coffee-focused routes for a shorter city reset.',
    filters: {
      category: 'coffee',
    },
  },
  {
    id: 'nature-break',
    label: 'Nature Break',
    description: 'Nature-heavy routes for a quieter pace.',
    filters: {
      category: 'nature',
    },
  },
  {
    id: 'shopping-day',
    label: 'Shopping Day',
    description: 'Public shopping routes with optimized stop flow.',
    filters: {
      category: 'shopping',
    },
  },
];
