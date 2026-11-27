import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { FinanceLoanService } from './finance-loan.service';
import { CreatePayoutReceiptDto } from './dto/create-payout-receipt.dto';
import { UpdatePayoutDto } from './dto/update-payout.dto';

interface RequestWithUser {
  user: AuthenticatedUser;
}

@Controller('finance/payouts')
@UseGuards(JwtAuthGuard)
export class FinancePayoutController {
  constructor(private readonly loanService: FinanceLoanService) {}

  /**
   * GET /api/finance/payouts
   * List payouts with filters, status, and pagination.
   */
  @Get()
  async findAllPayouts(
    @Req() req: RequestWithUser,
    @Query('kind') kind?: string,
    @Query('status') status?: string,
    @Query('lenderId') lenderId?: string,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
    @Query('overdueOnly') overdueOnly?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.loanService.findAllPayouts(req.user, {
      kind,
      status,
      lenderId,
      branchId,
      search,
      overdueOnly,
      fromDate,
      toDate,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /api/finance/payouts/summary
   * Summary metrics for payouts.
   */
  @Get('summary')
  async getPayoutSummary(
    @Req() req: RequestWithUser,
    @Query('kind') kind?: string,
    @Query('branchId') branchId?: string,
    @Query('lenderId') lenderId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.loanService.getPayoutSummary(req.user, {
      kind,
      branchId,
      lenderId,
      fromDate,
      toDate,
    });
  }

  /**
   * GET /api/finance/payouts/alerts
   * Active payout alerts (due soon, overdue, date to confirm).
   */
  @Get('alerts')
  async getPayoutAlerts(
    @Req() req: RequestWithUser,
    @Query('branchId') branchId?: string,
  ) {
    return this.loanService.getPayoutAlerts(req.user, branchId);
  }

  /**
   * GET /api/finance/payouts/:id
   * Get single payout by ID.
   */
  @Get(':id')
  async findPayoutById(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.loanService.findPayoutById(req.user, id);
  }

  /**
   * POST /api/finance/payouts/:id/receipts
   * Record a receipt for a payout.
   */
  @Post(':id/receipts')
  @HttpCode(HttpStatus.CREATED)
  async recordPayoutReceipt(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: CreatePayoutReceiptDto,
  ) {
    return this.loanService.recordPayoutReceipt(req.user, id, dto);
  }

  /**
   * PATCH /api/finance/payouts/:id
   * Edit expected payout terms (expectedAmount, expectedDate, notes).
   */
  @Patch(':id')
  async updatePayout(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdatePayoutDto,
  ) {
    return this.loanService.updatePayout(req.user, id, dto);
  }
}
