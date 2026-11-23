import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** GET /api/health — basic liveness check. Always returns ok if the process is running. */
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'nexus-erp-backend',
    };
  }

  /**
   * GET /api/health/ready — readiness check.
   * Reports whether the database connection is reachable.
   * Credentials are never included in the response.
   */
  async readyCheck(): Promise<{ status: string; database: string; timestamp: string }> {
    const timestamp = new Date().toISOString();
    try {
      // A cheap no-op query to confirm the connection works
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', database: 'connected', timestamp };
    } catch (err) {
      this.logger.warn(`Database readiness check failed: ${(err as Error).message}`);
      return { status: 'not_ready', database: 'unreachable', timestamp };
    }
  }
}
