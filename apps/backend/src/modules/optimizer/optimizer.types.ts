export type OptimizerHealthResponse = {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  environment: string;
};

export type OptimizerOptimizeRequest = {
  trip_id: string;
  date: string;
  preferences: {
    categories?: string[];
    time_start?: string;
    time_end?: string;
    budget_tl?: number;
    walking_tolerance_km?: number;
    max_pois?: number;
    weather?: 'clear' | 'cloudy' | 'rainy';
  };
  destination_anchor?: {
    lat: number;
    lng: number;
  };
  candidate_pois: Array<{
    poi_id: string;
    name: string;
    location: {
      lat: number;
      lng: number;
    };
    category: string;
    opening_hours: {
      open: string;
      close: string;
    };
    budget: {
      min_tl: number;
      max_tl: number;
    };
    visit_duration_minutes: number;
    destination_relevance?: 'primary' | 'nearby' | 'fallback';
  }>;
};

export type OptimizerOptimizeResponse = {
  trip_id: string;
  date: string;
  route: {
    route_name: string;
    total_distance_km: number;
    total_cost_tl: number;
    total_duration_minutes: number;
    stops: Array<{
      poi_id: string;
      name: string;
      arrival_time: string;
      departure_time: string;
      travel_time_to_next_minutes: number | null;
      travel_mode_to_next?: 'walk' | 'transfer' | null;
      estimated_cost_tl: number;
    }>;
  };
  algorithm_used: string;
  generated_at: string;
};
