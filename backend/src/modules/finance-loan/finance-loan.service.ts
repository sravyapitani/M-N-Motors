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
import { UpdateLoanDto } from './dto/update-loan.dto';
import { CreatePayoutReceiptDto } from './dto/create-payout-receipt.dto';
import { UpdatePayoutDto } from './dto/update-payout.dto';
import {
  computeExpectedDate,
  toCents,
  fromCents,
  computePayoutStatus,
} from './payout-calculator';
import {
  classifyPayoutAlert,
  PayoutAlertItem,
  PayoutAlertKind,
} from './payout-alerts';
import { LoanStatus, JournalStatus, PayoutKind } from '../../generated/prisma/enums';
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
    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(query.fromDate.trim())) {
          throw new BadRequestException('fromDate must be in YYYY-MM-DD format');
        }
        const fromD = new Date(`${query.fromDate.trim()}T00:00:00.000+05:30`);
        if (isNaN(fromD.getTime())) {
          throw new BadRequestException('Invalid fromDate');
        }
        where.createdAt.gte = fromD;
      }
      if (query.toDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(query.toDate.trim())) {
          throw new BadRequestException('toDate must be in YYYY-MM-DD format');
        }
        const toD = new Date(`${query.toDate.trim()}T23:59:59.999+05:30`);
        if (isNaN(toD.getTime())) {
          throw new BadRequestException('Invalid toDate');
        }
        where.createdAt.lte = toD;
      }
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

    // 4. Commission amount: variable, user provided (default 0 if not specified)
    const rawCommission =
      dto.commissionAmount !== undefined && dto.commissionAmount !== null
        ? dto.commissionAmount
        : 0;
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

    const statusDateUpdate: Record<string, unknown> = { status: nextStatus };
    const now = new Date();
    if (nextStatus === LoanStatus.SUBMITTED) statusDateUpdate.submittedAt = now;
    if (nextStatus === LoanStatus.UNDER_REVIEW) statusDateUpdate.underReviewAt = now;
    if (nextStatus === LoanStatus.SANCTIONED) statusDateUpdate.sanctionedAt = now;
    if (nextStatus === LoanStatus.DISBURSED) statusDateUpdate.disbursedAt = now;
    if (nextStatus === LoanStatus.REJECTED) statusDateUpdate.rejectedAt = now;

    try {
      if (nextStatus === LoanStatus.DISBURSED && this.isGlPostingEnabled()) {
        return await this.prisma.$transaction(
          async (tx) => {
          // Verify status is still SANCTIONED before updating (concurrency guard)
          const updateResult = await tx.loanApplication.updateMany({
            where: { id: cleanId, status: LoanStatus.SANCTIONED },
            data: { status: LoanStatus.DISBURSED, disbursedAt: now },
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

          // Create LoanPayout inside the same transaction if payout model is available in tx
          // Rule: Each DISBURSED loan has TWO payouts:
          // 1. DO amount (LOAN_AMOUNT): expected 2 days after disbursement (or lender.payoutDays override)
          // 2. Commission (COMMISSION, includes GST): expected 60 days after disbursement (or lender.commissionPayoutDays override). Created only when commissionAmount > 0.
          if ((tx as any).loanPayout) {
            const lender = loan.lenderId
              ? await tx.lender.findUnique({
                  where: { id: loan.lenderId },
                  select: { id: true, payoutDays: true, commissionPayoutDays: true },
                })
              : null;

            // 1. DO amount (LOAN_AMOUNT)
            const loanAmountExpDate = computeExpectedDate(now, 'LOAN_AMOUNT', lender);
            await (tx as any).loanPayout.upsert({
              where: {
                loanId_kind: {
                  loanId: cleanId,
                  kind: PayoutKind.LOAN_AMOUNT,
                },
              },
              update: {},
              create: {
                loanId: cleanId,
                kind: PayoutKind.LOAN_AMOUNT,
                expectedAmount: loan.loanAmount,
                expectedDate: loanAmountExpDate,
                dateEstimated: false,
              },
            });

            // 2. Commission (COMMISSION) - create only when commissionAmount > 0
            const commNum = Number(loan.commissionAmount);
            if (commNum > 0) {
              const commExpDate = computeExpectedDate(now, 'COMMISSION', lender);
              await (tx as any).loanPayout.upsert({
                where: {
                  loanId_kind: {
                    loanId: cleanId,
                    kind: PayoutKind.COMMISSION,
                  },
                },
                update: {},
                create: {
                  loanId: cleanId,
                  kind: PayoutKind.COMMISSION,
                  expectedAmount: loan.commissionAmount,
                  expectedDate: commExpDate,
                  dateEstimated: false,
                },
              });
            }
          }

          return updatedLoan;
        }, { timeout: 20000, maxWait: 10000 });
      }

      const updated = await this.prisma.loanApplication.update({
        where: { id: cleanId },
        data: statusDateUpdate,
        include: {
          branch: { select: { id: true, code: true, name: true } },
          submittingUser: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      if (nextStatus === LoanStatus.DISBURSED && (this.prisma as any).loanPayout) {
        try {
          const lender = loan.lenderId
            ? await this.prisma.lender.findUnique({
                where: { id: loan.lenderId },
                select: { id: true, payoutDays: true, commissionPayoutDays: true },
              })
            : null;

          // 1. DO amount (LOAN_AMOUNT)
          const loanAmountExpDate = computeExpectedDate(now, 'LOAN_AMOUNT', lender);
          await (this.prisma as any).loanPayout.upsert({
            where: {
              loanId_kind: {
                loanId: cleanId,
                kind: PayoutKind.LOAN_AMOUNT,
              },
            },
            update: {},
            create: {
              loanId: cleanId,
              kind: PayoutKind.LOAN_AMOUNT,
              expectedAmount: loan.loanAmount,
              expectedDate: loanAmountExpDate,
              dateEstimated: false,
            },
          });

          // 2. Commission (COMMISSION) - create only when commissionAmount > 0
          const commNum = Number(loan.commissionAmount);
          if (commNum > 0) {
            const commExpDate = computeExpectedDate(now, 'COMMISSION', lender);
            await (this.prisma as any).loanPayout.upsert({
              where: {
                loanId_kind: {
                  loanId: cleanId,
                  kind: PayoutKind.COMMISSION,
                },
              },
              update: {},
              create: {
                loanId: cleanId,
                kind: PayoutKind.COMMISSION,
                expectedAmount: loan.commissionAmount,
                expectedDate: commExpDate,
                dateEstimated: false,
              },
            });
          }
        } catch (err: any) {
          this.logger.warn(`Failed to create payout on disbursement: ${err.message}`);
        }
      }

      return updated;
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
   * PATCH /api/finance/loans/:id
   * Update details of an existing loan application (customer name, loan amount, interest rate, tenure, commission, lender).
   */
  async update(user: AuthenticatedUser, id: string, dto: UpdateLoanDto) {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new BadRequestException('A valid loan application ID is required.');
    }
    const cleanId = id.trim();

    const loan = await this.prisma.loanApplication.findUnique({
      where: { id: cleanId },
    });

    if (!loan) {
      throw new NotFoundException(`Loan application with ID '${cleanId}' was not found.`);
    }

    this.verifyBranchAccess(user, loan.branchId);

    const dataToUpdate: Record<string, unknown> = {};

    if (dto.customerName !== undefined) {
      const name = dto.customerName.trim();
      if (!name) throw new BadRequestException('Customer name cannot be empty.');
      dataToUpdate.customerName = name;
    }

    if (dto.loanAmount !== undefined) {
      if (dto.loanAmount <= 0) throw new BadRequestException('Loan amount must be greater than zero.');
      dataToUpdate.loanAmount = dto.loanAmount;
    }

    if (dto.interestRate !== undefined) {
      if (dto.interestRate < 0 || dto.interestRate > 100) {
        throw new BadRequestException('Interest rate must be between 0% and 100%.');
      }
      dataToUpdate.interestRate = dto.interestRate;
    }

    if (dto.tenureMonths !== undefined) {
      if (dto.tenureMonths < 1 || dto.tenureMonths > 360) {
        throw new BadRequestException('Tenure must be between 1 and 360 months.');
      }
      dataToUpdate.tenureMonths = dto.tenureMonths;
    }

    if (dto.commissionAmount !== undefined && dto.commissionAmount !== null) {
      if (dto.commissionAmount < 0) {
        throw new BadRequestException('Commission amount cannot be negative.');
      }
      dataToUpdate.commissionAmount = Math.round(dto.commissionAmount * 100) / 100;
    }

    if (dto.branchId !== undefined) {
      const branchId = dto.branchId.trim();
      this.verifyBranchAccess(user, branchId);
      const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch || !branch.isActive) {
        throw new BadRequestException(`Branch '${branchId}' is invalid or inactive.`);
      }
      dataToUpdate.branchId = branchId;
    }

    if (dto.lenderId !== undefined || dto.lenderName !== undefined) {
      if (dto.lenderId?.trim()) {
        const cleanLenderId = dto.lenderId.trim();
        const lender = this.prisma.lender
          ? await this.prisma.lender.findUnique({ where: { id: cleanLenderId } })
          : null;
        if (!lender || !lender.isActive) {
          throw new BadRequestException(`Lender '${cleanLenderId}' is invalid or inactive.`);
        }
        dataToUpdate.lenderId = lender.id;
        dataToUpdate.lenderName = lender.name;
      } else if (dto.lenderName?.trim()) {
        const cleanName = dto.lenderName.trim();
        if (this.prisma.lender) {
          const matchedLender = await this.prisma.lender.findFirst({
            where: {
              isActive: true,
              OR: [
                { name: { equals: cleanName, mode: 'insensitive' } },
                { tallyLedgerName: { equals: cleanName, mode: 'insensitive' } },
              ],
            },
          });
          if (matchedLender) {
            dataToUpdate.lenderId = matchedLender.id;
            dataToUpdate.lenderName = matchedLender.name;
          } else {
            dataToUpdate.lenderId = null;
            dataToUpdate.lenderName = cleanName;
          }
        } else {
          dataToUpdate.lenderId = null;
          dataToUpdate.lenderName = cleanName;
        }
      }
    }

    try {
      return await this.prisma.loanApplication.update({
        where: { id: cleanId },
        data: dataToUpdate,
        include: {
          branch: { select: { id: true, code: true, name: true } },
          lender: { select: { id: true, name: true, type: true } },
          submittingUser: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update loan ${cleanId}: ${(error as Error).message}`);
      throw new InternalServerErrorException('Error updating loan application.');
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

  // =========================================================================
  // PAYOUT TRACKER METHODS
  // =========================================================================

  /**
   * Helper to check PAYOUT_MANAGE permission.
   * SYSTEM_ADMIN bypasses this check in code.
   */
  private verifyPayoutManageAccess(user: AuthenticatedUser) {
    if (this.isAdmin(user)) return;
    const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
    if (!permissions.includes('PAYOUT_MANAGE')) {
      throw new ForbiddenException(
        'Access denied: You require the PAYOUT_MANAGE permission to perform this action.',
      );
    }
  }

  /**
   * Helper to check PAYOUT_VIEW permission.
   * SYSTEM_ADMIN bypasses this check in code.
   */
  private verifyPayoutViewAccess(user: AuthenticatedUser) {
    if (this.isAdmin(user)) return;
    const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
    if (!permissions.includes('PAYOUT_VIEW')) {
      throw new ForbiddenException(
        'Access denied: You require the PAYOUT_VIEW permission to perform this action.',
      );
    }
  }

  /**
   * GET /api/finance/payouts
   * List payouts with pagination, status calculation, daysOverdue, and branch scoping.
   */
  async findAllPayouts(
    user: AuthenticatedUser,
    query: {
      kind?: string;
      status?: string;
      lenderId?: string;
      branchId?: string;
      search?: string;
      overdueOnly?: string | boolean;
      fromDate?: string;
      toDate?: string;
      page?: number;
      limit?: number;
    },
  ) {
    this.verifyPayoutViewAccess(user);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));

    // Branch scoping
    let branchFilter: string | { in: string[] } | undefined;
    const requestedBranch = query.branchId?.trim();
    if (requestedBranch && requestedBranch !== 'ALL') {
      this.verifyBranchAccess(user, requestedBranch);
      branchFilter = requestedBranch;
    } else if (!this.isAdmin(user)) {
      const userBranchIds = Array.isArray(user?.branchIds) ? user.branchIds : [];
      if (userBranchIds.length === 0) {
        return { data: [], total: 0, page, limit, totalPages: 0 };
      }
      branchFilter = { in: userBranchIds };
    }

    const where: any = {
      loan: {
        ...(branchFilter ? { branchId: branchFilter } : {}),
      },
    };

    if (query.kind && (query.kind === 'LOAN_AMOUNT' || query.kind === 'COMMISSION')) {
      where.kind = query.kind as PayoutKind;
    }

    if (query.lenderId && query.lenderId !== 'ALL') {
      where.loan.lenderId = query.lenderId;
    }

    if (query.search?.trim()) {
      where.loan.customerName = { contains: query.search.trim(), mode: 'insensitive' };
    }

    if (query.fromDate || query.toDate) {
      where.expectedDate = {};
      if (query.fromDate) where.expectedDate.gte = new Date(query.fromDate);
      if (query.toDate) where.expectedDate.lte = new Date(query.toDate);
    }

    const allPayouts = await this.prisma.loanPayout.findMany({
      where,
      orderBy: { expectedDate: 'asc' },
      include: {
        loan: {
          include: {
            branch: { select: { id: true, code: true, name: true } },
            lender: { select: { id: true, name: true, payoutDays: true, commissionPayoutDays: true } },
          },
        },
        receipts: {
          orderBy: { receivedDate: 'desc' },
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        history: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    const isOverdueOnly = String(query.overdueOnly) === 'true';

    // Enrich and compute statuses
    const enriched = allPayouts.map((p) => {
      const receivedCents = p.receipts.reduce((acc, r) => acc + toCents(r.amount), 0);
      const calc = computePayoutStatus({
        expectedAmount: p.expectedAmount,
        receivedAmount: fromCents(receivedCents),
        expectedDate: p.expectedDate,
        dateEstimated: p.dateEstimated,
      });

      return {
        id: p.id,
        loanId: p.loanId,
        kind: p.kind,
        customerName: p.loan.customerName,
        branchId: p.loan.branchId,
        branchName: p.loan.branch.name,
        lenderId: p.loan.lenderId,
        lenderName: p.loan.lenderName,
        expectedAmount: calc.expectedAmount,
        receivedAmount: calc.receivedAmount,
        outstandingAmount: calc.outstandingAmount,
        expectedDate: p.expectedDate,
        dateEstimated: p.dateEstimated,
        status: calc.status,
        daysOverdue: calc.daysOverdue,
        notes: p.notes,
        createdAt: p.createdAt,
        receipts: p.receipts,
        history: p.history,
      };
    });

    // Filter by computed status or overdue
    let filtered = enriched;
    if (query.status && query.status !== 'ALL') {
      filtered = filtered.filter((p) => p.status === query.status);
    }
    if (isOverdueOnly) {
      filtered = filtered.filter((p) => p.status === 'OVERDUE');
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const pagedData = filtered.slice((page - 1) * limit, page * limit);

    return {
      data: pagedData,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * GET /api/finance/payouts/summary
   * Summary metrics for payouts. Payouts with dateEstimated are NOT counted as overdue.
   */
  async getPayoutSummary(
    user: AuthenticatedUser,
    query: {
      kind?: string;
      branchId?: string;
      lenderId?: string;
      fromDate?: string;
      toDate?: string;
    },
  ) {
    this.verifyPayoutViewAccess(user);
    let branchFilter: string | { in: string[] } | undefined;
    const requestedBranch = query.branchId?.trim();
    if (requestedBranch && requestedBranch !== 'ALL') {
      this.verifyBranchAccess(user, requestedBranch);
      branchFilter = requestedBranch;
    } else if (!this.isAdmin(user)) {
      const userBranchIds = Array.isArray(user?.branchIds) ? user.branchIds : [];
      branchFilter = { in: userBranchIds };
    }

    const where: any = {
      loan: {
        ...(branchFilter ? { branchId: branchFilter } : {}),
      },
    };

    if (query.kind && (query.kind === 'LOAN_AMOUNT' || query.kind === 'COMMISSION')) {
      where.kind = query.kind as PayoutKind;
    }

    if (query.lenderId && query.lenderId !== 'ALL') {
      where.loan.lenderId = query.lenderId;
    }

    if (query.fromDate || query.toDate) {
      where.expectedDate = {};
      if (query.fromDate) where.expectedDate.gte = new Date(query.fromDate);
      if (query.toDate) where.expectedDate.lte = new Date(query.toDate);
    }

    const payouts = await this.prisma.loanPayout.findMany({
      where,
      include: {
        loan: {
          include: {
            lender: { select: { id: true, name: true } },
          },
        },
        receipts: true,
      },
    });

    let totalExpectedCents = 0;
    let totalReceivedCents = 0;
    let totalOutstandingCents = 0;
    let overdueCents = 0;
    let overdueCount = 0;
    let dateToConfirmCount = 0;
    const byKind: Record<string, { expected: number; received: number; outstanding: number; overdue: number; count: number }> = {
      LOAN_AMOUNT: { expected: 0, received: 0, outstanding: 0, overdue: 0, count: 0 },
      COMMISSION: { expected: 0, received: 0, outstanding: 0, overdue: 0, count: 0 },
    };

    const lenderMap: Record<string, {
      id: string | null;
      name: string;
      count: number;
      expectedCents: number;
      receivedCents: number;
      outstandingCents: number;
      overdueCents: number;
      overdueCount: number;
    }> = {};

    for (const p of payouts) {
      const recCents = p.receipts.reduce((acc, r) => acc + toCents(r.amount), 0);
      const calc = computePayoutStatus({
        expectedAmount: p.expectedAmount,
        receivedAmount: fromCents(recCents),
        expectedDate: p.expectedDate,
        dateEstimated: p.dateEstimated,
      });

      totalExpectedCents += calc.expectedCents;
      totalReceivedCents += calc.receivedCents;
      totalOutstandingCents += calc.outstandingCents;

      if (p.dateEstimated) {
        dateToConfirmCount += 1;
      } else if (calc.status === 'OVERDUE') {
        overdueCents += calc.outstandingCents;
        overdueCount += 1;
      }

      if (p.kind && byKind[p.kind]) {
        byKind[p.kind].count += 1;
        byKind[p.kind].expected += calc.expectedAmount;
        byKind[p.kind].received += calc.receivedAmount;
        byKind[p.kind].outstanding += calc.outstandingAmount;
        if (calc.status === 'OVERDUE' && !p.dateEstimated) {
          byKind[p.kind].overdue += calc.outstandingAmount;
        }
      }

      const lKey = p.loan.lenderId || p.loan.lenderName || 'Other';
      if (!lenderMap[lKey]) {
        lenderMap[lKey] = {
          id: p.loan.lenderId,
          name: p.loan.lenderName,
          count: 0,
          expectedCents: 0,
          receivedCents: 0,
          outstandingCents: 0,
          overdueCents: 0,
          overdueCount: 0,
        };
      }

      const lEntry = lenderMap[lKey];
      lEntry.count += 1;
      lEntry.expectedCents += calc.expectedCents;
      lEntry.receivedCents += calc.receivedCents;
      lEntry.outstandingCents += calc.outstandingCents;
      if (calc.status === 'OVERDUE' && !p.dateEstimated) {
        lEntry.overdueCents += calc.outstandingCents;
        lEntry.overdueCount += 1;
      }
    }

    const byLender = Object.values(lenderMap).map((l) => ({
      id: l.id,
      name: l.name,
      count: l.count,
      totalExpected: fromCents(l.expectedCents),
      totalReceived: fromCents(l.receivedCents),
      totalOutstanding: fromCents(l.outstandingCents),
      overdueAmount: fromCents(l.overdueCents),
      overdueCount: l.overdueCount,
    }));

    return {
      totalExpected: fromCents(totalExpectedCents),
      totalReceived: fromCents(totalReceivedCents),
      totalOutstanding: fromCents(totalOutstandingCents),
      overdueAmount: fromCents(overdueCents),
      overdueCount,
      dateToConfirmCount,
      byKind,
      byLender,
    };
  }

  /**
   * GET /api/finance/payouts/alerts
   * Active payout alerts (due soon, overdue, date to confirm) computed on read.
   * Compares expectedDate against Asia/Kolkata (IST) calendar dates.
   */
  async getPayoutAlerts(user: AuthenticatedUser, branchIdQuery?: string) {
    this.verifyPayoutViewAccess(user);

    let branchFilter: string | { in: string[] } | undefined;
    const requestedBranch = branchIdQuery?.trim();
    if (requestedBranch && requestedBranch !== 'ALL') {
      this.verifyBranchAccess(user, requestedBranch);
      branchFilter = requestedBranch;
    } else if (!this.isAdmin(user)) {
      const userBranchIds = Array.isArray(user?.branchIds) ? user.branchIds : [];
      if (userBranchIds.length === 0) {
        return {
          summary: {
            totalAlerts: 0,
            dueSoonCount: 0,
            overdueCount: 0,
            dateToConfirmCount: 0,
            totalOutstandingAlertAmount: 0,
          },
          alerts: [],
        };
      }
      branchFilter = { in: userBranchIds };
    }

    const payouts = await this.prisma.loanPayout.findMany({
      where: {
        loan: {
          ...(branchFilter ? { branchId: branchFilter } : {}),
        },
      },
      include: {
        loan: {
          include: {
            branch: { select: { id: true, code: true, name: true } },
            lender: { select: { id: true, name: true } },
          },
        },
        receipts: {
          select: { amount: true },
        },
      },
      orderBy: {
        expectedDate: 'asc',
      },
    });

    const now = new Date();
    const alerts: PayoutAlertItem[] = [];

    for (const p of payouts) {
      const expectedAmount = Number(p.expectedAmount);
      const receivedAmount = p.receipts.reduce((sum, r) => sum + Number(r.amount), 0);
      const outstanding = Math.round((expectedAmount - receivedAmount) * 100) / 100;
      if (outstanding <= 0) continue;

      const alert = classifyPayoutAlert(
        {
          payoutId: p.id,
          loanId: p.loanId,
          customerName: p.loan.customerName,
          branchId: p.loan.branchId,
          branchCode: p.loan.branch?.code,
          branchName: p.loan.branch?.name,
          lenderId: p.loan.lenderId,
          lenderName: p.loan.lender?.name || p.loan.lenderName,
          kind: p.kind as PayoutAlertKind,
          expectedAmount,
          receivedAmount,
          expectedDate: p.expectedDate,
          dateEstimated: p.dateEstimated,
        },
        now,
      );

      if (alert) {
        alerts.push(alert);
      }
    }

    const dueSoonCount = alerts.filter((a) => a.alertType === 'DUE_SOON').length;
    const overdueCount = alerts.filter((a) => a.alertType === 'OVERDUE').length;
    const dateToConfirmCount = alerts.filter((a) => a.alertType === 'DATE_TO_CONFIRM').length;
    const totalOutstandingAlertAmount = alerts.reduce(
      (sum, a) => sum + a.outstandingAmount,
      0,
    );

    return {
      summary: {
        totalAlerts: alerts.length,
        dueSoonCount,
        overdueCount,
        dateToConfirmCount,
        totalOutstandingAlertAmount: Math.round(totalOutstandingAlertAmount * 100) / 100,
      },
      alerts,
    };
  }

  /**
   * POST /api/finance/payouts/:id/receipts
   * Records a receipt in a transaction that re-reads the payout and receipts.
   * amount > 0, partial payments allowed, warn (don't block) if total goes over expectedAmount.
   */
  async recordPayoutReceipt(
    user: AuthenticatedUser,
    payoutId: string,
    dto: CreatePayoutReceiptDto,
  ) {
    this.verifyPayoutManageAccess(user);

    if (dto.amount <= 0) {
      throw new BadRequestException('Receipt amount must be greater than zero.');
    }

    return await this.prisma.$transaction(async (tx) => {
      const payout = await tx.loanPayout.findUnique({
        where: { id: payoutId },
        include: {
          loan: true,
          receipts: true,
        },
      });

      if (!payout) {
        throw new NotFoundException(`Loan payout with ID '${payoutId}' not found.`);
      }

      this.verifyBranchAccess(user, payout.loan.branchId);

      const currentReceivedCents = payout.receipts.reduce(
        (acc, r) => acc + toCents(r.amount),
        0,
      );
      const newReceiptCents = toCents(dto.amount);
      const totalNewReceivedCents = currentReceivedCents + newReceiptCents;
      const expectedCents = toCents(payout.expectedAmount);

      let warning: string | undefined;
      if (totalNewReceivedCents > expectedCents) {
        warning = `Total received (₹${fromCents(totalNewReceivedCents)}) exceeds expected amount (₹${fromCents(expectedCents)}).`;
      }

      const receipt = await tx.loanPayoutReceipt.create({
        data: {
          payoutId: payout.id,
          amount: dto.amount,
          receivedDate: new Date(dto.receivedDate),
          reference: dto.reference?.trim() || null,
          receivedInto: dto.receivedInto?.trim() || null,
          createdById: user.userId,
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return {
        ...receipt,
        warning,
      };
    });
  }

  /**
   * GET /api/finance/payouts/:id
   * Get a single payout by ID.
   */
  async findPayoutById(user: AuthenticatedUser, payoutId: string) {
    this.verifyPayoutViewAccess(user);

    const p = await this.prisma.loanPayout.findUnique({
      where: { id: payoutId },
      include: {
        loan: {
          include: {
            branch: { select: { id: true, code: true, name: true } },
            lender: { select: { id: true, name: true, payoutDays: true, commissionPayoutDays: true } },
          },
        },
        receipts: {
          orderBy: { receivedDate: 'desc' },
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        history: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!p) {
      throw new NotFoundException(`Loan payout with ID '${payoutId}' not found.`);
    }

    this.verifyBranchAccess(user, p.loan.branchId);

    const receivedCents = p.receipts.reduce((acc, r) => acc + toCents(r.amount), 0);
    const calc = computePayoutStatus({
      expectedAmount: p.expectedAmount,
      receivedAmount: fromCents(receivedCents),
      expectedDate: p.expectedDate,
      dateEstimated: p.dateEstimated,
    });

    return {
      id: p.id,
      loanId: p.loanId,
      kind: p.kind,
      customerName: p.loan.customerName,
      branchId: p.loan.branchId,
      branchName: p.loan.branch.name,
      lenderId: p.loan.lenderId,
      lenderName: p.loan.lenderName,
      expectedAmount: calc.expectedAmount,
      receivedAmount: calc.receivedAmount,
      outstandingAmount: calc.outstandingAmount,
      expectedDate: p.expectedDate,
      dateEstimated: p.dateEstimated,
      status: calc.status,
      daysOverdue: calc.daysOverdue,
      notes: p.notes,
      createdAt: p.createdAt,
      receipts: p.receipts,
      history: p.history,
    };
  }

  /**
   * PATCH /api/finance/payouts/:id
   * Edit expectedAmount, expectedDate, or notes.
   * Writes one LoanPayoutHistory row per changed field.
   * Editing expectedDate sets dateEstimated = false.
   */
  async updatePayout(
    user: AuthenticatedUser,
    payoutId: string,
    dto: UpdatePayoutDto,
  ) {
    this.verifyPayoutManageAccess(user);

    return await this.prisma.$transaction(async (tx) => {
      const payout = await tx.loanPayout.findUnique({
        where: { id: payoutId },
        include: { loan: true },
      });

      if (!payout) {
        throw new NotFoundException(`Loan payout with ID '${payoutId}' not found.`);
      }

      this.verifyBranchAccess(user, payout.loan.branchId);

      const updateData: any = {};
      const historyEntries: { field: string; oldValue: string | null; newValue: string | null }[] = [];

      if (dto.expectedAmount !== undefined && dto.expectedAmount !== null) {
        if (dto.expectedAmount < 0) {
          throw new BadRequestException('Expected amount cannot be negative.');
        }
        const oldVal = String(payout.expectedAmount);
        const newVal = String(dto.expectedAmount);
        if (oldVal !== newVal) {
          updateData.expectedAmount = dto.expectedAmount;
          historyEntries.push({
            field: 'expectedAmount',
            oldValue: `₹${oldVal}`,
            newValue: `₹${newVal}`,
          });
        }
      }

      if (dto.expectedDate) {
        const oldDateStr = payout.expectedDate.toISOString().split('T')[0];
        const newDate = new Date(dto.expectedDate);
        const newDateStr = newDate.toISOString().split('T')[0];

        if (oldDateStr !== newDateStr) {
          updateData.expectedDate = newDate;
          updateData.dateEstimated = false; // Editing expectedDate sets dateEstimated = false
          historyEntries.push({
            field: 'expectedDate',
            oldValue: oldDateStr,
            newValue: newDateStr,
          });
        }
      }

      if (dto.notes !== undefined) {
        const oldNotes = payout.notes || '';
        const newNotes = dto.notes?.trim() || '';
        if (oldNotes !== newNotes) {
          updateData.notes = newNotes || null;
          historyEntries.push({
            field: 'notes',
            oldValue: oldNotes || null,
            newValue: newNotes || null,
          });
        }
      }

      const updated = await tx.loanPayout.update({
        where: { id: payoutId },
        data: updateData,
        include: {
          loan: {
            include: {
              branch: { select: { id: true, code: true, name: true } },
              lender: { select: { id: true, name: true } },
            },
          },
          receipts: true,
          history: {
            orderBy: { createdAt: 'desc' },
            include: {
              user: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      });

      for (const entry of historyEntries) {
        await tx.loanPayoutHistory.create({
          data: {
            payoutId: payout.id,
            userId: user.userId,
            field: entry.field,
            oldValue: entry.oldValue,
            newValue: entry.newValue,
          },
        });
      }

      return updated;
    });
  }
}
