import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type AppConfig } from '../config/app.config';

type PrismaClientInstance = {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
};

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly databaseUrl: string;
  private client: PrismaClientInstance | null = null;
  private clientPromise: Promise<PrismaClientInstance> | null = null;

  constructor(private readonly configService: ConfigService) {
    const config = configService.getOrThrow<AppConfig>('app', {
      infer: true,
    });
    this.databaseUrl = config.DATABASE_URL;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.$disconnect();
    }
  }

  async getClient(): Promise<PrismaClientInstance> {
    if (this.client) {
      return this.client;
    }

    if (!this.clientPromise) {
      this.clientPromise = this.createClient();
    }

    this.client = await this.clientPromise;
    return this.client;
  }

  private async createClient(): Promise<PrismaClientInstance> {
    try {
      const [prismaModule, adapterModule] = await Promise.all([
        import('@prisma/client'),
        import('@prisma/adapter-pg'),
      ]);
      const PrismaClient =
        (prismaModule as { PrismaClient?: new (...args: unknown[]) => PrismaClientInstance })
          .PrismaClient ??
        (
          prismaModule as {
            default?: { PrismaClient?: new (...args: unknown[]) => PrismaClientInstance };
          }
        ).default?.PrismaClient;
      const PrismaPg =
        (adapterModule as { PrismaPg?: new (...args: unknown[]) => unknown }).PrismaPg ??
        (
          adapterModule as {
            default?: { PrismaPg?: new (...args: unknown[]) => unknown };
          }
        ).default?.PrismaPg;

      if (!PrismaClient || !PrismaPg) {
        throw new Error('Prisma runtime modules could not be loaded');
      }

      const client = new PrismaClient({
        adapter: new PrismaPg({
          connectionString: this.databaseUrl,
        }),
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
