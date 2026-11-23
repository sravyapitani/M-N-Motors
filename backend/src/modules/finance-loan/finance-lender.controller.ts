import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FinanceLoanService } from './finance-loan.service';
import { LenderQueryDto } from './dto/lender-query.dto';

@Controller('finance/lenders')
@UseGuards(JwtAuthGuard)
export class FinanceLenderController {
  constructor(private readonly loanService: FinanceLoanService) {}

  /**
   * GET /api/finance/lenders
   * Read-only endpoint to retrieve lenders with optional active status, type, and search filters.
   */
  @Get()
  async findAll(@Query() query: LenderQueryDto) {
    return this.loanService.findAllLenders(query);
  }
}

