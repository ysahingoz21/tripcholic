import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { type AppConfig } from '../config/app.config';
import {
  OptimizerPreviewRequestDto,
  PreviewCandidatePlaceDto,
  PreviewPreferencesDto,
} from './dto/optimizer-preview.dto';
import {
  OptimizerHealthResponse,
  OptimizerOptimizeRequest,
  OptimizerOptimizeResponse,
} from './optimizer.types';

const OPTIMIZER_CATEGORY_MAP: Record<string, string[]> = {
  historical: ['historical'],
  scenic: ['scenic'],
  food: ['food'],
  shopping: ['shopping'],
  nature: ['nature'],
  neighborhood: ['neighborhood'],
  entertainment: ['entertainment'],
  culture: ['historical', 'entertainment', 'neighborhood'],
  history: ['historical'],
  museums: ['entertainment', 'historical'],
  coffee: ['food', 'neighborhood'],
  nightlife: ['entertainment', 'food'],
};

const BUDGET_LEVEL_TO_TL: Record<'low' | 'medium' | 'high', number> = {
  low: 2000,
  medium: 6000,
  high: 20000,
};

const BUDGET_LEVEL_TO_RANGE: Record<
  'low' | 'medium' | 'high',
  { min_tl: number; max_tl: number }
> = {
  low: { min_tl: 0, max_tl: 2000 },
  medium: { min_tl: 2000, max_tl: 6000 },
  high: { min_tl: 6000, max_tl: 20000 },
};

@Injectable()
export class OptimizerService {
  private readonly optimizerUrl: string;

  constructor(private readonly configService: ConfigService) {
    const config = configService.getOrThrow<AppConfig>('app', {
      infer: true,
    });

    this.optimizerUrl = config.OPTIMIZER_URL.replace(/\/$/, '');
  }

  async getOptimizerHealth() {
    const health = await this.request<OptimizerHealthResponse>({
      method: 'GET',
      url: `${this.optimizerUrl}/health`,
    });

    return {
      status: health.status === 'ok' ? 'ok' : 'degraded',
      optimizer: health,
    };
  }

  async callOptimize(request: OptimizerOptimizeRequest): Promise<OptimizerOptimizeResponse> {
    return this.request<OptimizerOptimizeResponse>({
      method: 'POST',
      url: `${this.optimizerUrl}/optimize`,
      data: request,
    });
  }

  async previewRoute(previewRequest: OptimizerPreviewRequestDto) {
    const optimizerRequest = this.mapPreviewRequestToOptimizer(previewRequest);
    const optimizerResponse = await this.request<OptimizerOptimizeResponse>({
      method: 'POST',
      url: `${this.optimizerUrl}/optimize`,
      data: optimizerRequest,
    });

    return {
      previewId: previewRequest.previewId,
      optimizerRequest,
      optimizerResult: optimizerResponse,
    };
  }

  private mapPreviewRequestToOptimizer(
    previewRequest: OptimizerPreviewRequestDto,
  ): OptimizerOptimizeRequest {
    return {
      trip_id: previewRequest.previewId,
      date: previewRequest.tripDate,
      preferences: this.mapPreferences(previewRequest.preferences),
      candidate_pois: previewRequest.candidatePlaces.map((place) =>
        this.mapCandidatePlace(place),
      ),
    };
  }

  private mapPreferences(
    preferences: PreviewPreferencesDto,
  ): OptimizerOptimizeRequest['preferences'] {
    return {
      categories: preferences.categories
        ? this.expandCategories(preferences.categories)
        : undefined,
      time_start: preferences.startTime,
      time_end: preferences.endTime,
      budget_tl: this.resolveBudgetTl(preferences),
      walking_tolerance_km: preferences.maxWalkingDistanceKm,
      max_pois: preferences.maxStops,
      weather: preferences.weather,
    };
  }

  private mapCandidatePlace(
    place: PreviewCandidatePlaceDto,
  ): OptimizerOptimizeRequest['candidate_pois'][number] {
    return {
      poi_id: place.placeId,
      name: place.title,
      location: {
        lat: place.coordinates.lat,
        lng: place.coordinates.lng,
      },
      category: this.mapSingleCategory(place.category),
      opening_hours: {
        open: place.openingHours.open,
        close: place.openingHours.close,
      },
      budget: this.resolveBudgetRange(place),
      visit_duration_minutes: place.suggestedVisitDurationMinutes,
    };
  }

  private expandCategories(categories: string[]): string[] {
    return [...new Set(categories.flatMap((category) => OPTIMIZER_CATEGORY_MAP[category] ?? ['historical']))];
  }

  private mapSingleCategory(category: string): string {
    return this.expandCategories([category])[0];
  }

  private resolveBudgetTl(preferences: PreviewPreferencesDto): number | undefined {
    if (preferences.maxBudgetTl !== undefined) {
      return preferences.maxBudgetTl;
    }

    if (preferences.budgetLevel) {
      return BUDGET_LEVEL_TO_TL[preferences.budgetLevel];
    }

    return undefined;
  }

  private resolveBudgetRange(
    place: PreviewCandidatePlaceDto,
  ): { min_tl: number; max_tl: number } {
    if (
      place.pricing.minTl !== undefined &&
      place.pricing.maxTl !== undefined
    ) {
      return {
        min_tl: place.pricing.minTl,
        max_tl: place.pricing.maxTl,
      };
    }

    if (place.pricing.budgetLevel) {
      return BUDGET_LEVEL_TO_RANGE[place.pricing.budgetLevel];
    }

    return {
      min_tl: place.pricing.minTl ?? 0,
      max_tl: place.pricing.maxTl ?? place.pricing.minTl ?? 500,
    };
  }

  private async request<T>(config: {
    method: 'GET' | 'POST';
    url: string;
    data?: unknown;
  }): Promise<T> {
    try {
      const response = await axios.request<T>({
        method: config.method,
        url: config.url,
        data: config.data,
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.rethrowOptimizerError(error);
      }

      throw new ServiceUnavailableException('Optimizer service is unavailable');
    }
  }

  private rethrowOptimizerError(error: AxiosError): never {
        if (error.response) {
      console.error(
        'OPTIMIZER ERROR DATA:',
        JSON.stringify(error.response.data, null, 2),
      );

      throw new BadGatewayException({
        message: 'Optimizer service returned an error',
        optimizerStatus: error.response.status,
        optimizerData: error.response.data,
      });
    }
    throw new ServiceUnavailableException('Optimizer service is unavailable');
  }
}
