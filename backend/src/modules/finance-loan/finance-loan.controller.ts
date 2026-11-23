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
import { CreateLoanDto } from './dto/create-loan.dto';
import { LoanQueryDto } from './dto/loan-query.dto';
import { UpdateLoanStatusDto } from './dto/update-loan-status.dto';
import { FinanceLoanService } from './finance-loan.service';

interface RequestWithUser {
  user: AuthenticatedUser;
}

@Controller('finance/loans')
@UseGuards(JwtAuthGuard)
export class FinanceLoanController {
  constructor(private readonly loanService: FinanceLoanService) {}

  /**
   * GET /api/finance/loans
   * List loan applications with pagination and filters.
   */
  @Get()
  async findAll(@Req() req: RequestWithUser, @Query() query: LoanQueryDto) {
    return this.loanService.findAll(req.user, query);
  }

  /**
   * GET /api/finance/loans/metrics
   * Aggregate metrics for the loan desk dashboard.
   * NOTE: Placed before ':id' to prevent route collision.
   */
  @Get('metrics')
  async getMetrics(
    @Req() req: RequestWithUser,
    @Query('branchId') branchId?: string,
  ) {
    return this.loanService.getMetrics(req.user, branchId);
  }

  /**
   * POST /api/finance/loans
   * Submit a new loan application.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: RequestWithUser, @Body() dto: CreateLoanDto) {
    return this.loanService.create(req.user, dto);
  }

  /**
   * GET /api/finance/loans/:id
   * Retrieve a single loan application by ID.
   */
  @Get(':id')
  async findOne(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.loanService.findOne(req.user, id);
  }

  /**
   * PATCH /api/finance/loans/:id/status
   * Update the status of an existing loan application.
   */
  @Patch(':id/status')
  async updateStatus(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateLoanStatusDto,
  ) {
    return this.loanService.updateStatus(req.user, id, dto);
  }
}
