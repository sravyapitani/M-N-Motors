import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
// Prisma 7 generates the client to a custom output path defined in schema.prisma
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Prisma 7 requires an explicit driver adapter for PostgreSQL.
    // The pg Pool reads DATABASE_URL from the environment (loaded by dotenv in main.ts).
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Database connection established');
    } catch (err) {
      this.logger.warn(
        `Database connection could not be established on startup: ${(err as Error).message}. Continuing in degraded mode.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }
}
