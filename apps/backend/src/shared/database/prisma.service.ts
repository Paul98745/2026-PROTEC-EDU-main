import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private client?: PrismaClient;

  constructor(private readonly configService: ConfigService) {}

  getClient(): PrismaClient {
    if (!this.client) {
      const connectionString = this.configService.get<string>('DATABASE_URL');

      if (!connectionString) {
        throw new Error('DATABASE_URL is required to use the database client.');
      }

      this.client = new PrismaClient({
        adapter: new PrismaPg({ connectionString }),
      });
    }

    return this.client;
  }

  async onModuleDestroy() {
    await this.client?.$disconnect();
  }
}
