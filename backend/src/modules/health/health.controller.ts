import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** GET /api/health — liveness probe */
  @Get()
  getHealth() {
    return this.healthService.check();
  }

  /** GET /api/health/ready — readiness probe (verifies database reachability) */
  @Get('ready')
  async getReady() {
    return this.healthService.readyCheck();
  }
}
