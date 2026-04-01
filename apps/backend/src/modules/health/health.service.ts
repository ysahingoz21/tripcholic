import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getHealth() {
    return {
      status: 'ok' as const,
      service: 'tripcholic-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
