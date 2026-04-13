import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { type AppConfig } from '../config/app.config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly databaseUrl: string;
  private client: PrismaClient | null = null;
  private clientPromise: Promise<PrismaClient> | null = null;

  constructor(private readonly configService: ConfigService) {
    const config = configService.getOrThrow<AppConfig>('app', { infer: true });
    this.databaseUrl = config.DATABASE_URL;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.$disconnect();
    }
  }

  async getClient(): Promise<PrismaClient> {
    if (this.client) return this.client;
    if (!this.clientPromise) this.clientPromise = this.createClient();
    this.client = await this.clientPromise;
    return this.client;
  }

  private async createClient(): Promise<PrismaClient> {
    try {
      const client = new PrismaClient({
        adapter: new PrismaPg({ connectionString: this.databaseUrl }),
      });
      await client.$connect();
      this.logger.log('Prisma connection initialized');
      return client;
    } catch (error) {
      this.clientPromise = null;
      this.logger.error(
        'Prisma client initialization failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
