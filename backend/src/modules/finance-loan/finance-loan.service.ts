import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CreateLoanDto } from './dto/create-loan.dto';
import { LoanQueryDto } from './dto/loan-query.dto';
import { LenderQueryDto } from './dto/lender-query.dto';
import { UpdateLoanStatusDto } from './dto/update-loan-status.dto';
import { LoanStatus, JournalStatus } from '../../generated/prisma/enums';
import { Prisma } from '../../generated/prisma/client';
import { GeneralLedgerService } from '../general-ledger/general-ledger.service';
import { resolveDisbursementAccounts } from './gl-account-resolver';

// Valid status transitions for the dealership loan pipeline
const ALLOWED_STATUS_TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
  [LoanStatus.ENQUIRY]: [LoanStatus.SUBMITTED, LoanStatus.REJECTED],
  [LoanStatus.SUBMITTED]: [LoanStatus.UNDER_REVIEW, LoanStatus.REJECTED],
  [LoanStatus.UNDER_REVIEW]: [LoanStatus.SANCTIONED, LoanStatus.REJECTED],
  [LoanStatus.SANCTIONED]: [LoanStatus.DISBURSED, LoanStatus.REJECTED],
  [LoanStatus.DISBURSED]: [], // Terminal state
  [LoanStatus.REJECTED]: [LoanStatus.ENQUIRY, LoanStatus.SUBMITTED], // Allow re-opening
};

// Required permissions for privileged status transitions
export const REQUIRED_STATUS_PERMISSIONS: Partial<Record<LoanStatus, string>> = {
  [LoanStatus.SANCTIONED]: 'LOAN_APPROVE',
  [LoanStatus.DISBURSED]: 'LOAN_DISBURSE',
};

@Injectable()
export class FinanceLoanService {
  private readonly logger = new Logger(FinanceLoanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly glService?: GeneralLedgerService,
  ) {}

  /**
   * Check if General Ledger posting on loan disbursement is enabled via feature flag.
   */
  private isGlPostingEnabled(): boolean {
    return process.env.ENABLE_GL_POSTING === 'true';
  }

  /**
   * Helper to verify if the user is a System Administrator
   */
  private isAdmin(user?: AuthenticatedUser): boolean {
    if (!user) return false;
    const roles = Array.isArray(user.roles) ? user.roles : [];
    const permissions = Array.isArray(user.permissions) ? user.permissions : [];
    return (
      roles.includes('SYSTEM_ADMIN') ||
      permissions.includes('SYSTEM_ADMIN')
    );
  }

  /**
   * Helper to verify if the user has permission to access the target branch
   */
  private verifyBranchAccess(user: AuthenticatedUser, branchId: string): void {
    if (this.isAdmin(user)) {
      return;
    }
    if (!branchId || typeof branchId !== 'string' || !branchId.trim()) {
      throw new BadRequestException('A valid branch ID is required.');
    }
    const userBranchIds = Array.isArray(user?.branchIds) ? user.branchIds : [];
    if (!userBranchIds.includes(branchId.trim())) {
      throw new ForbiddenException(
        `Access denied: You do not have permission to access branch '${branchId}'.`,
      );
    }
  }

  /**
   * GET /api/finance/lenders
   * List lenders with optional active status, type, and search filters.
   */
  async findAllLenders(query: LenderQueryDto) {
    const where: Prisma.LenderWhereInput = {};
    if (typeof query.isActive === 'boolean') {
      where.isActive = query.isActive;
    }
    if (query.type) {
      where.type = query.type;
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { tallyLedgerName: { contains: term, mode: 'insensitive' } },
      ];
    }

    try {
      return await this.prisma.lender.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        select: {
          id: true,
          name: true,
          tallyLedgerName: true,
          type: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to list lenders: ${(error as Error).message}`);
      throw new InternalServerErrorException('Error retrieving lenders.');
    }
  }

  /**
   * GET /api/finance/loans
   * List loan applications with pagination and filters.
   */
  async findAll(user: AuthenticatedUser, query: LoanQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(100, query.limit ?? 20));
    const skip = (page - 1) * limit;

    // Build branch security scope
    let branchFilter: string | { in: string[] } | undefined;
    const requestedBranch = query.branchId?.trim();
    if (requestedBranch) {
      this.verifyBranchAccess(user, requestedBranch);
      branchFilter = requestedBranch;
    } else if (!this.isAdmin(user)) {
      const userBranchIds = Array.isArray(user?.branchIds) ? user.branchIds : [];
      if (userBranchIds.length === 0) {
        return {
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }
      branchFilter = { in: userBranchIds };
    }

    const where: any = {};
    if (branchFilter) {
      where.branchId = branchFilter;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.lender?.trim()) {
      where.lenderName = { contains: query.lender.trim(), mode: 'insensitive' };
    }
    if (query.search?.trim()) {
      where.customerName = { contains: query.search.trim(), mode: 'insensitive' };
    }

    try {
      const [total, data] = await Promise.all([
        this.prisma.loanApplication.count({ where }),
        this.prisma.loanApplication.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            branch: { select: { id: true, code: true, name: true } },
            lender: { select: { id: true, name: true, type: true } },
            submittingUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        }),
      ]);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(`Failed to list loan applications: ${(error as Error).message}`);
      throw new InternalServerErrorException('Error retrieving loan applications.');
    }
  }

  /**
   * POST /api/finance/loans
   * Create a new loan application.
   */
  async create(user: AuthenticatedUser, dto: CreateLoanDto) {
    if (!user?.userId) {
      throw new UnauthorizedException('A valid authenticated user session is required.');
    }

    const branchId = dto.branchId?.trim();
    if (!branchId) {
      throw new BadRequestException('A valid branch ID is required.');
    }

    // 1. Verify branch access
    this.verifyBranchAccess(user, branchId);

    // 2. Verify branch actually exists
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch || !branch.isActive) {
      throw new BadRequestException(`Branch '${branchId}' is invalid or inactive.`);
    }

    // 3. Resolve and validate lender
    let lenderId: string | null = null;
    let lenderName = dto.lenderName?.trim();

    if (dto.lenderId?.trim()) {
      const cleanLenderId = dto.lenderId.trim();
      const lender = this.prisma.lender
        ? await this.prisma.lender.findUnique({
            where: { id: cleanLenderId },
          })
        : null;
      if (!lender || !lender.isActive) {
        throw new BadRequestException(`Lender '${cleanLenderId}' is invalid or inactive.`);
      }
      lenderId = lender.id;
      lenderName = lender.name;
    } else if (lenderName) {
      if (this.prisma.lender) {
        const matchedLender = await this.prisma.lender.findFirst({
          where: {
            isActive: true,
            OR: [
              { name: { equals: lenderName, mode: 'insensitive' } },
              { tallyLedgerName: { equals: lenderName, mode: 'insensitive' } },
            ],
          },
        });
        if (matchedLender) {
          lenderId = matchedLender.id;
          lenderName = matchedLender.name;
        }
      }
    } else {
      throw new BadRequestException('Either a valid lender ID or lender name is required.');
    }

    const customerName = dto.customerName?.trim();
    if (!customerName) {
      throw new BadRequestException('Customer name cannot be empty.');
    }

    // 4. Calculate commission (default: 2% of loan amount if not specified; round to 2 decimals)
    const rawCommission =
      dto.commissionAmount !== undefined && dto.commissionAmount !== null
        ? dto.commissionAmount
        : dto.loanAmount * 0.02;
    const commission = Math.round(rawCommission * 100) / 100;

    try {
      return await this.prisma.loanApplication.create({
        data: {
          customerName,
          lenderName: lenderName || 'Unknown Lender',
          lenderId,
          loanAmount: dto.loanAmount,
          interestRate: dto.interestRate,
          tenureMonths: dto.tenureMonths,
          commissionAmount: commission,
          status: LoanStatus.ENQUIRY,
          branchId,
          submittingUserId: user.userId,
        },
        include: {
          branch: { select: { id: true, code: true, name: true } },
          lender: { select: { id: true, name: true, type: true } },
          submittingUser: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create loan application: ${(error as Error).message}`);
      throw new InternalServerErrorException('Error saving loan application.');
    }
  }

  /**
   * GET /api/finance/loans/:id
   * Retrieve a single loan application by ID.
   */
  async findOne(user: AuthenticatedUser, id: string) {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new BadRequestException('A valid loan application ID is required.');
    }
    const cleanId = id.trim();

    const loan = await this.prisma.loanApplication.findUnique({
      where: { id: cleanId },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        lender: { select: { id: true, name: true, type: true } },
        submittingUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!loan) {
      throw new NotFoundException(`Loan application with ID '${cleanId}' was not found.`);
    }

    this.verifyBranchAccess(user, loan.branchId);
    return loan;
  }

  /**
   * PATCH /api/finance/loans/:id/status
   * Update the status of a loan application adhering to allowed state transitions.
   */
  async updateStatus(user: AuthenticatedUser, id: string, dto: UpdateLoanStatusDto) {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new BadRequestException('A valid loan application ID is required.');
    }
    const cleanId = id.trim();

    if (!dto?.status || !Object.values(LoanStatus).includes(dto.status)) {
      throw new BadRequestException('A valid target loan status is required.');
    }

    const loan = await this.prisma.loanApplication.findUnique({
      where: { id: cleanId },
    });

    if (!loan) {
      throw new NotFoundException(`Loan application with ID '${cleanId}' was not found.`);
    }

    this.verifyBranchAccess(user, loan.branchId);

    const currentStatus = loan.status;
    const nextStatus = dto.status;

    if (currentStatus === nextStatus) {
      return this.findOne(user, cleanId);
    }

    const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(nextStatus)) {
      const allowedMsg =
        allowed.length > 0
          ? `Allowed next states: ${allowed.join(', ')}.`
          : 'This application is in a terminal state and cannot be changed.';
      throw new BadRequestException(
        `Invalid status transition from '${currentStatus}' to '${nextStatus}'. ${allowedMsg}`,
      );
    }

    // RBAC Permission Check (403 Forbidden)
    const requiredPermission = REQUIRED_STATUS_PERMISSIONS[nextStatus];
    if (requiredPermission && !this.isAdmin(user)) {
      const userPermissions = Array.isArray(user?.permissions) ? user.permissions : [];
      if (!userPermissions.includes(requiredPermission)) {
        const actionVerb =
          nextStatus === LoanStatus.SANCTIONED ? 'sanction' : 'disburse';
        throw new ForbiddenException(
          `Access denied: You require the '${requiredPermission}' permission to ${actionVerb} a loan application.`,
        );
      }
    }

    try {
      if (nextStatus === LoanStatus.DISBURSED && this.isGlPostingEnabled()) {
        return await this.prisma.$transaction(async (tx) => {
          // Verify status is still SANCTIONED before updating (concurrency guard)
          const updateResult = await tx.loanApplication.updateMany({
            where: { id: cleanId, status: LoanStatus.SANCTIONED },
            data: { status: LoanStatus.DISBURSED },
          });

          if (updateResult.count !== 1) {
            throw new BadRequestException(
              `Loan application '${cleanId}' is not in SANCTIONED status or was concurrently modified.`,
            );
          }

          const updatedLoan = await tx.loanApplication.findUniqueOrThrow({
            where: { id: cleanId },
            include: {
              branch: { select: { id: true, code: true, name: true } },
              submittingUser: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          });

          const commissionCents = Math.round(Number(loan.commissionAmount ?? 0) * 100);

          // PROVISIONAL ASSUMPTION: When commissionAmount is 0, skip General Ledger journal entry creation.
          // Unconfirmed with Finance Controller / Akash. Standard GL invariants reject ₹0 journal lines.
          // No GST lines are generated pending monthly consolidated billing tax policy confirmation.
          if (commissionCents > 0) {
            const { receivableAccountId, revenueAccountId } =
              await resolveDisbursementAccounts(tx, loan.branchId);

            const commissionAmount = commissionCents / 100;

            if (!this.glService) {
              throw new InternalServerErrorException(
                'GeneralLedgerService is required when ENABLE_GL_POSTING is enabled.',
              );
            }

            await this.glService.createJournalEntry(
              user,
              {
                branchId: loan.branchId,
                entryDate: new Date(),
                status: JournalStatus.POSTED,
                sourceModule: 'FINANCE_LOAN',
                sourceReference: cleanId,
                narration: `Automated commission posting on disbursement for loan application ${cleanId} (${loan.customerName} - ${loan.lenderName})`,
                lines: [
                  {
                    accountId: receivableAccountId,
                    description: `Lender commission receivable for loan ${cleanId}`,
                    debitAmount: commissionAmount,
                    creditAmount: 0,
                  },
                  {
                    accountId: revenueAccountId,
                    description: `F&I commission revenue for loan ${cleanId}`,
                    debitAmount: 0,
                    creditAmount: commissionAmount,
                  },
                ],
              },
              tx,
            );
          }

          return updatedLoan;
        });
      }

      return await this.prisma.loanApplication.update({
        where: { id: cleanId },
        data: { status: nextStatus },
        include: {
          branch: { select: { id: true, code: true, name: true } },
          submittingUser: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Failed to update loan status for ${cleanId}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException('Error updating loan status.');
    }
  }

  /**
   * GET /api/finance/loans/metrics
   * Aggregate metrics for the Finance & Loan Desk overview cards and charts.
   */
  async getMetrics(user: AuthenticatedUser, branchId?: string) {
    const cleanBranchId =
      typeof branchId === 'string' && branchId.trim() ? branchId.trim() : undefined;

    let branchFilter: string | { in: string[] } | undefined;
    if (cleanBranchId) {
      this.verifyBranchAccess(user, cleanBranchId);
      branchFilter = cleanBranchId;
    } else if (!this.isAdmin(user)) {
      const userBranchIds = Array.isArray(user?.branchIds) ? user.branchIds : [];
      if (userBranchIds.length === 0) {
        return {
          totalApplications: 0,
          activeLoans: 0,
          disbursedCount: 0,
          totalDisbursedAmount: 0,
          totalCommissionEarned: 0,
          byStatus: {},
          byLender: [],
        };
      }
      branchFilter = { in: userBranchIds };
    }

    const where: any = {};
    if (branchFilter) {
      where.branchId = branchFilter;
    }

    try {
      const loans = await this.prisma.loanApplication.findMany({
        where,
        select: {
          status: true,
          loanAmount: true,
          commissionAmount: true,
          lenderName: true,
          lenderId: true,
          lender: { select: { id: true, name: true } },
        },
      });

      const totalApplications = loans.length;
      let activeLoans = 0;
      let disbursedCount = 0;
      let totalDisbursedAmount = 0;
      let totalCommissionEarned = 0;

      const byStatus: Record<string, { count: number; totalAmount: number }> = {};
      const lenderMap: Record<
        string,
        {
          name: string;
          count: number;
          totalAmountCents: number;
          commissionCents: number;
          disbursedCount: number;
          disbursedAmountCents: number;
          pendingCount: number;
          pendingAmountCents: number;
          enquiryCount: number;
          enquiryAmountCents: number;
          rejectedCount: number;
          rejectedAmountCents: number;
        }
      > = {};

      for (const loan of loans) {
        const amount = Number(loan.loanAmount) || 0;
        const commission = Number(loan.commissionAmount) || 0;
        const amountCents = Math.round(amount * 100);
        const commissionCents = Math.round(commission * 100);

        // Status Breakdown
        if (!byStatus[loan.status]) {
          byStatus[loan.status] = { count: 0, totalAmount: 0 };
        }
        byStatus[loan.status].count += 1;
        byStatus[loan.status].totalAmount += amount;

        // Active vs Disbursed
        if (
          loan.status !== LoanStatus.DISBURSED &&
          loan.status !== LoanStatus.REJECTED
        ) {
          activeLoans += 1;
        }

        if (loan.status === LoanStatus.DISBURSED) {
          disbursedCount += 1;
          totalDisbursedAmount += amount;
          totalCommissionEarned += commission;
        }

        // Lender Breakdown
        const lenderKey = loan.lenderId || loan.lenderName;
        const lenderDisplayName = loan.lender?.name || loan.lenderName;

        if (!lenderMap[lenderKey]) {
          lenderMap[lenderKey] = {
            name: lenderDisplayName,
            count: 0,
            totalAmountCents: 0,
            commissionCents: 0,
            disbursedCount: 0,
            disbursedAmountCents: 0,
            pendingCount: 0,
            pendingAmountCents: 0,
            enquiryCount: 0,
            enquiryAmountCents: 0,
            rejectedCount: 0,
            rejectedAmountCents: 0,
          };
        }
        const lenderEntry = lenderMap[lenderKey];
        lenderEntry.count += 1;
        lenderEntry.totalAmountCents += amountCents;
        lenderEntry.commissionCents += commissionCents;

        if (loan.status === LoanStatus.DISBURSED) {
          lenderEntry.disbursedCount += 1;
          lenderEntry.disbursedAmountCents += amountCents;
        } else if (
          loan.status === LoanStatus.SUBMITTED ||
          loan.status === LoanStatus.UNDER_REVIEW ||
          loan.status === LoanStatus.SANCTIONED
        ) {
          lenderEntry.pendingCount += 1;
          lenderEntry.pendingAmountCents += amountCents;
        } else if (loan.status === LoanStatus.ENQUIRY) {
          lenderEntry.enquiryCount += 1;
          lenderEntry.enquiryAmountCents += amountCents;
        } else if (loan.status === LoanStatus.REJECTED) {
          lenderEntry.rejectedCount += 1;
          lenderEntry.rejectedAmountCents += amountCents;
        }
      }

      const byLender = Object.values(lenderMap)
        .map((entry) => ({
          name: entry.name,
          count: entry.count,
          totalAmount: entry.totalAmountCents / 100,
          commission: entry.commissionCents / 100,
          disbursedCount: entry.disbursedCount,
          disbursedAmount: entry.disbursedAmountCents / 100,
          pendingCount: entry.pendingCount,
          pendingAmount: entry.pendingAmountCents / 100,
          enquiryCount: entry.enquiryCount,
          enquiryAmount: entry.enquiryAmountCents / 100,
          rejectedCount: entry.rejectedCount,
          rejectedAmount: entry.rejectedAmountCents / 100,
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount);

      return {
        totalApplications,
        activeLoans,
        disbursedCount,
        totalDisbursedAmount: Math.round(totalDisbursedAmount * 100) / 100,
        totalCommissionEarned: Math.round(totalCommissionEarned * 100) / 100,
        byStatus,
        byLender,
      };
    } catch (error) {
      this.logger.error(`Failed to calculate loan metrics: ${(error as Error).message}`);
      throw new InternalServerErrorException('Error calculating loan metrics.');
    }
  }
}
