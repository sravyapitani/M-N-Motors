import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { FinanceLoanService } from './finance-loan.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { LoanQueryDto } from './dto/loan-query.dto';
import { LoanStatus } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

describe('FinanceLoanService', () => {
  const mockAdminUser: AuthenticatedUser = {
    userId: 'user-admin-1',
    email: 'admin@nexus.local',
    department: 'FINANCE',
    roles: ['SYSTEM_ADMIN'],
    permissions: [],
    branchIds: ['branch-mumbai', 'branch-pune'],
  };

  const mockBranchUser: AuthenticatedUser = {
    userId: 'user-staff-1',
    email: 'staff@nexus.local',
    department: 'FINANCE',
    roles: ['LOAN_OFFICER'],
    permissions: [],
    branchIds: ['branch-mumbai'],
  };

  const mockFinanceManagerUser: AuthenticatedUser = {
    userId: 'user-fm-1',
    email: 'fm@nexus.local',
    department: 'FINANCE',
    roles: ['FINANCE_MANAGER'],
    permissions: ['LOAN_APPROVE', 'LOAN_DISBURSE'],
    branchIds: ['branch-mumbai'],
  };

  const sampleLoan = {
    id: 'loan-1',
    customerName: 'Ayesha Rao',
    lenderName: 'Vertex Capital',
    loanAmount: 500000,
    interestRate: 10.5,
    tenureMonths: 36,
    commissionAmount: 10000,
    status: LoanStatus.ENQUIRY,
    branchId: 'branch-mumbai',
    submittingUserId: 'user-staff-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    branch: { id: 'branch-mumbai', code: 'MUM', name: 'Mumbai' },
    submittingUser: {
      id: 'user-staff-1',
      firstName: 'Staff',
      lastName: 'User',
      email: 'staff@nexus.local',
    },
  };

  it('should successfully create a loan application with 2% auto-calculated commission', async () => {
    let createdData: any = null;
    const mockPrisma: any = {
      branch: {
        findUnique: async () => ({ id: 'branch-mumbai', isActive: true }),
      },
      loanApplication: {
        create: async ({ data }: any) => {
          createdData = data;
          return {
            id: 'new-loan-id',
            ...data,
            branch: sampleLoan.branch,
            submittingUser: sampleLoan.submittingUser,
          };
        },
      },
    };

    const service = new FinanceLoanService(mockPrisma);
    const result = await service.create(mockBranchUser, {
      customerName: 'Ayesha Rao',
      lenderName: 'Vertex Capital',
      loanAmount: 600000,
      interestRate: 9.5,
      tenureMonths: 48,
      branchId: 'branch-mumbai',
    });

    assert.ok(result);
    assert.strictEqual(createdData.commissionAmount, 12000); // 2% of 600000 = 12000
    assert.strictEqual(createdData.status, LoanStatus.ENQUIRY);
    assert.strictEqual(createdData.submittingUserId, mockBranchUser.userId);
  });

  it('should round explicit commission to 2 decimal places and trim customer/lender names', async () => {
    let createdData: any = null;
    const mockPrisma: any = {
      branch: {
        findUnique: async () => ({ id: 'branch-mumbai', isActive: true }),
      },
      loanApplication: {
        create: async ({ data }: any) => {
          createdData = data;
          return {
            id: 'new-loan-id',
            ...data,
            branch: sampleLoan.branch,
            submittingUser: sampleLoan.submittingUser,
          };
        },
      },
    };

    const service = new FinanceLoanService(mockPrisma);
    await service.create(mockBranchUser, {
      customerName: '   Ayesha Rao   ',
      lenderName: '   Vertex Capital   ',
      loanAmount: 500000,
      interestRate: 10,
      tenureMonths: 24,
      commissionAmount: 10500.4567, // fractional cents
      branchId: 'branch-mumbai',
    });

    assert.strictEqual(createdData.customerName, 'Ayesha Rao');
    assert.strictEqual(createdData.lenderName, 'Vertex Capital');
    assert.strictEqual(createdData.commissionAmount, 10500.46);
  });

  it('should reject loan creation if user does not have access to the target branch', async () => {
    const mockPrisma: any = {};
    const service = new FinanceLoanService(mockPrisma);

    await assert.rejects(
      async () => {
        await service.create(mockBranchUser, {
          customerName: 'Ayesha Rao',
          lenderName: 'Vertex Capital',
          loanAmount: 500000,
          interestRate: 10,
          tenureMonths: 24,
          branchId: 'branch-pune', // User only has access to branch-mumbai
        });
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenException);
        assert.match(err.message, /permission to access branch 'branch-pune'/);
        return true;
      },
    );
  });

  it('should reject loan creation if target branch does not exist or is inactive', async () => {
    const mockPrisma: any = {
      branch: {
        findUnique: async () => null,
      },
    };
    const service = new FinanceLoanService(mockPrisma);

    await assert.rejects(
      async () => {
        await service.create(mockBranchUser, {
          customerName: 'Ayesha Rao',
          lenderName: 'Vertex Capital',
          loanAmount: 500000,
          interestRate: 10,
          tenureMonths: 24,
          branchId: 'branch-mumbai',
        });
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestException);
        assert.match(err.message, /invalid or inactive/);
        return true;
      },
    );
  });

  it('should reject loan creation if user context has no userId', async () => {
    const mockPrisma: any = {};
    const service = new FinanceLoanService(mockPrisma);

    await assert.rejects(
      async () => {
        await service.create({} as any, {
          customerName: 'Ayesha Rao',
          lenderName: 'Vertex Capital',
          loanAmount: 500000,
          interestRate: 10,
          tenureMonths: 24,
          branchId: 'branch-mumbai',
        });
      },
      (err: any) => {
        assert.ok(err instanceof UnauthorizedException);
        assert.match(err.message, /valid authenticated user session/);
        return true;
      },
    );
  });

  it('should scope loan queries to user branch access', async () => {
    let capturedWhere: any = null;
    const mockPrisma: any = {
      loanApplication: {
        count: async () => 1,
        findMany: async ({ where }: any) => {
          capturedWhere = where;
          return [sampleLoan];
        },
      },
    };

    const service = new FinanceLoanService(mockPrisma);
    const result = await service.findAll(mockBranchUser, { page: 1, limit: 10 });

    assert.strictEqual(result.total, 1);
    assert.deepStrictEqual(capturedWhere.branchId, { in: ['branch-mumbai'] });
  });

  it('should allow system admin to query across all branches', async () => {
    let capturedWhere: any = null;
    const mockPrisma: any = {
      loanApplication: {
        count: async () => 2,
        findMany: async ({ where }: any) => {
          capturedWhere = where;
          return [sampleLoan];
        },
      },
    };

    const service = new FinanceLoanService(mockPrisma);
    await service.findAll(mockAdminUser, {});

    // For admin with no explicit branchId filter, branchId is not restricted in where
    assert.strictEqual(capturedWhere.branchId, undefined);
  });

  it('should retrieve a single loan application if authorized', async () => {
    const mockPrisma: any = {
      loanApplication: {
        findUnique: async () => sampleLoan,
      },
    };

    const service = new FinanceLoanService(mockPrisma);
    const loan = await service.findOne(mockBranchUser, 'loan-1');
    assert.strictEqual(loan.id, 'loan-1');
  });

  it('should reject findOne if loan does not exist (NotFoundException)', async () => {
    const mockPrisma: any = {
      loanApplication: {
        findUnique: async () => null,
      },
    };

    const service = new FinanceLoanService(mockPrisma);
    await assert.rejects(
      async () => {
        await service.findOne(mockBranchUser, 'non-existent-id');
      },
      (err: any) => {
        assert.ok(err instanceof NotFoundException);
        return true;
      },
    );
  });

  it('should reject findOne if non-admin user lacks access to loan branch (ForbiddenException)', async () => {
    const mockPrisma: any = {
      loanApplication: {
        findUnique: async () => ({ ...sampleLoan, branchId: 'branch-pune' }),
      },
    };

    const service = new FinanceLoanService(mockPrisma);
    await assert.rejects(
      async () => {
        await service.findOne(mockBranchUser, 'loan-1');
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenException);
        return true;
      },
    );
  });

  it('should enforce allowed status transitions and reject invalid transitions', async () => {
    const mockPrisma: any = {
      loanApplication: {
        findUnique: async () => ({ ...sampleLoan, status: LoanStatus.ENQUIRY }),
        update: async ({ data }: any) => ({ ...sampleLoan, status: data.status }),
      },
    };

    const service = new FinanceLoanService(mockPrisma);

    // Valid: ENQUIRY -> SUBMITTED
    const updated = await service.updateStatus(mockBranchUser, 'loan-1', {
      status: LoanStatus.SUBMITTED,
    });
    assert.strictEqual(updated.status, LoanStatus.SUBMITTED);

    // Invalid: ENQUIRY -> DISBURSED
    await assert.rejects(
      async () => {
        await service.updateStatus(mockBranchUser, 'loan-1', {
          status: LoanStatus.DISBURSED,
        });
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestException);
        assert.match(err.message, /Invalid status transition from 'ENQUIRY' to 'DISBURSED'/);
        return true;
      },
    );
  });

  it('should reject status updates when application is in terminal DISBURSED state', async () => {
    const mockPrisma: any = {
      loanApplication: {
        findUnique: async () => ({ ...sampleLoan, status: LoanStatus.DISBURSED }),
      },
    };

    const service = new FinanceLoanService(mockPrisma);
    await assert.rejects(
      async () => {
        await service.updateStatus(mockBranchUser, 'loan-1', {
          status: LoanStatus.REJECTED,
        });
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestException);
        assert.match(err.message, /terminal state/);
        return true;
      },
    );
  });

  it('should allow SYSTEM_ADMIN to sanction and disburse loans without explicit permissions', async () => {
    let updatedStatus: LoanStatus | null = null;
    const mockPrisma: any = {
      loanApplication: {
        findUnique: async () => ({ ...sampleLoan, status: LoanStatus.UNDER_REVIEW }),
        update: async ({ data }: any) => {
          updatedStatus = data.status;
          return { ...sampleLoan, status: data.status };
        },
      },
    };

    const service = new FinanceLoanService(mockPrisma);
    const resultSanction = await service.updateStatus(mockAdminUser, 'loan-1', {
      status: LoanStatus.SANCTIONED,
    });
    assert.strictEqual(resultSanction.status, LoanStatus.SANCTIONED);
    assert.strictEqual(updatedStatus, LoanStatus.SANCTIONED);

    mockPrisma.loanApplication.findUnique = async () => ({ ...sampleLoan, status: LoanStatus.SANCTIONED });
    const resultDisburse = await service.updateStatus(mockAdminUser, 'loan-1', {
      status: LoanStatus.DISBURSED,
    });
    assert.strictEqual(resultDisburse.status, LoanStatus.DISBURSED);
  });

  it('should allow FINANCE_MANAGER with LOAN_APPROVE and LOAN_DISBURSE to sanction and disburse in own branch', async () => {
    let updatedStatus: LoanStatus | null = null;
    const mockPrisma: any = {
      loanApplication: {
        findUnique: async () => ({ ...sampleLoan, status: LoanStatus.UNDER_REVIEW }),
        update: async ({ data }: any) => {
          updatedStatus = data.status;
          return { ...sampleLoan, status: data.status };
        },
      },
    };

    const service = new FinanceLoanService(mockPrisma);
    const sanctioned = await service.updateStatus(mockFinanceManagerUser, 'loan-1', {
      status: LoanStatus.SANCTIONED,
    });
    assert.strictEqual(sanctioned.status, LoanStatus.SANCTIONED);
    assert.strictEqual(updatedStatus, LoanStatus.SANCTIONED);

    mockPrisma.loanApplication.findUnique = async () => ({ ...sampleLoan, status: LoanStatus.SANCTIONED });
    const disbursed = await service.updateStatus(mockFinanceManagerUser, 'loan-1', {
      status: LoanStatus.DISBURSED,
    });
    assert.strictEqual(disbursed.status, LoanStatus.DISBURSED);
  });

  it('should reject regular branch user without LOAN_APPROVE when attempting to sanction (ForbiddenException)', async () => {
    const mockPrisma: any = {
      loanApplication: {
        findUnique: async () => ({ ...sampleLoan, status: LoanStatus.UNDER_REVIEW }),
      },
    };

    const service = new FinanceLoanService(mockPrisma);
    await assert.rejects(
      async () => {
        await service.updateStatus(mockBranchUser, 'loan-1', {
          status: LoanStatus.SANCTIONED,
        });
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenException);
        assert.match(err.message, /LOAN_APPROVE/);
        return true;
      },
    );
  });

  it('should reject regular branch user without LOAN_DISBURSE when attempting to disburse (ForbiddenException)', async () => {
    const mockPrisma: any = {
      loanApplication: {
        findUnique: async () => ({ ...sampleLoan, status: LoanStatus.SANCTIONED }),
      },
    };

    const service = new FinanceLoanService(mockPrisma);
    await assert.rejects(
      async () => {
        await service.updateStatus(mockBranchUser, 'loan-1', {
          status: LoanStatus.DISBURSED,
        });
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenException);
        assert.match(err.message, /LOAN_DISBURSE/);
        return true;
      },
    );
  });

  it('should allow regular branch user without permissions to perform standard transitions (SUBMITTED, UNDER_REVIEW, REJECTED, ENQUIRY)', async () => {
    let currentStatus = LoanStatus.ENQUIRY;
    const mockPrisma: any = {
      loanApplication: {
        findUnique: async () => ({ ...sampleLoan, status: currentStatus }),
        update: async ({ data }: any) => {
          currentStatus = data.status;
          return { ...sampleLoan, status: data.status };
        },
      },
    };

    const service = new FinanceLoanService(mockPrisma);

    const step1 = await service.updateStatus(mockBranchUser, 'loan-1', { status: LoanStatus.SUBMITTED });
    assert.strictEqual(step1.status, LoanStatus.SUBMITTED);

    const step2 = await service.updateStatus(mockBranchUser, 'loan-1', { status: LoanStatus.UNDER_REVIEW });
    assert.strictEqual(step2.status, LoanStatus.UNDER_REVIEW);

    const step3 = await service.updateStatus(mockBranchUser, 'loan-1', { status: LoanStatus.REJECTED });
    assert.strictEqual(step3.status, LoanStatus.REJECTED);

    const step4 = await service.updateStatus(mockBranchUser, 'loan-1', { status: LoanStatus.ENQUIRY });
    assert.strictEqual(step4.status, LoanStatus.ENQUIRY);
  });

  it('should block FINANCE_MANAGER from modifying a loan in another branch (ForbiddenException)', async () => {
    const mockPrisma: any = {
      loanApplication: {
        findUnique: async () => ({ ...sampleLoan, branchId: 'branch-pune', status: LoanStatus.UNDER_REVIEW }),
      },
    };

    const service = new FinanceLoanService(mockPrisma);
    await assert.rejects(
      async () => {
        await service.updateStatus(mockFinanceManagerUser, 'loan-1', {
          status: LoanStatus.SANCTIONED,
        });
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenException);
        assert.match(err.message, /branch 'branch-pune'/);
        return true;
      },
    );
  });

  it('should return existing loan without DB update when target status matches current status (same-status case)', async () => {
    let updateCalled = false;
    const mockPrisma: any = {
      loanApplication: {
        findUnique: async () => ({ ...sampleLoan, status: LoanStatus.SANCTIONED }),
        update: async () => {
          updateCalled = true;
          return sampleLoan;
        },
      },
    };

    const service = new FinanceLoanService(mockPrisma);
    const result = await service.updateStatus(mockBranchUser, 'loan-1', {
      status: LoanStatus.SANCTIONED,
    });
    assert.strictEqual(result.id, 'loan-1');
    assert.strictEqual(updateCalled, false);
  });

  it('should reject a REJECTED loan trying to reach SANCTIONED or DISBURSED directly with BadRequestException', async () => {
    const mockPrisma: any = {
      loanApplication: {
        findUnique: async () => ({ ...sampleLoan, status: LoanStatus.REJECTED }),
      },
    };

    const service = new FinanceLoanService(mockPrisma);

    await assert.rejects(
      async () => {
        await service.updateStatus(mockAdminUser, 'loan-1', {
          status: LoanStatus.SANCTIONED,
        });
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestException);
        assert.match(err.message, /Invalid status transition from 'REJECTED' to 'SANCTIONED'/);
        return true;
      },
    );

    await assert.rejects(
      async () => {
        await service.updateStatus(mockAdminUser, 'loan-1', {
          status: LoanStatus.DISBURSED,
        });
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestException);
        assert.match(err.message, /Invalid status transition from 'REJECTED' to 'DISBURSED'/);
        return true;
      },
    );
  });

  it('should calculate loan metrics correctly for dashboard widgets', async () => {
    const mockLoans = [
      {
        status: LoanStatus.ENQUIRY,
        loanAmount: 500000,
        commissionAmount: 10000,
        lenderName: 'Vertex Capital',
      },
      {
        status: LoanStatus.SUBMITTED,
        loanAmount: 800000,
        commissionAmount: 16000,
        lenderName: 'Vertex Capital',
      },
      {
        status: LoanStatus.DISBURSED,
        loanAmount: 1200000,
        commissionAmount: 24000,
        lenderName: 'BlueLeaf Finance',
      },
      {
        status: LoanStatus.REJECTED,
        loanAmount: 300000,
        commissionAmount: 6000,
        lenderName: 'Suraksha NBFC',
      },
    ];

    const mockPrisma: any = {
      loanApplication: {
        findMany: async () => mockLoans,
      },
    };

    const service = new FinanceLoanService(mockPrisma);
    const metrics = await service.getMetrics(mockAdminUser);

    assert.strictEqual(metrics.totalApplications, 4);
    assert.strictEqual(metrics.activeLoans, 2); // ENQUIRY, SUBMITTED
    assert.strictEqual(metrics.disbursedCount, 1);
    assert.strictEqual(metrics.totalDisbursedAmount, 1200000);
    assert.strictEqual(metrics.totalCommissionEarned, 24000);
    assert.strictEqual(metrics.byLender.length, 3);
  });

  it('should validate CreateLoanDto properly and reject invalid values', async () => {
    // Missing required fields
    const invalidDto = plainToInstance(CreateLoanDto, {
      customerName: '   ',
      lenderName: '',
      loanAmount: -100,
      interestRate: 150,
      tenureMonths: 12.5,
      branchId: '',
    });
    const errors = await validate(invalidDto);
    assert.ok(errors.length >= 5);

    // Valid DTO
    const validDto = plainToInstance(CreateLoanDto, {
      customerName: 'Rohit Sharma',
      lenderName: 'HDFC Bank',
      loanAmount: 850000,
      interestRate: 8.75,
      tenureMonths: 60,
      branchId: 'branch-1',
    });
    const validErrors = await validate(validDto);
    assert.strictEqual(validErrors.length, 0);
  });

  it('should validate LoanQueryDto properly and sanitize whitespace strings', async () => {
    const query = plainToInstance(LoanQueryDto, {
      page: 2,
      limit: 50,
      status: LoanStatus.SANCTIONED,
      search: '  Priya  ',
      lender: '   ',
    });
    const errors = await validate(query);
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(query.search, 'Priya');
    assert.strictEqual(query.lender, undefined);
  });

  describe('General Ledger Integration on Disbursement (ENABLE_GL_POSTING)', () => {
    const originalEnv = process.env.ENABLE_GL_POSTING;

    // Helper to mock tx and prisma
    const setupGlTestContext = (options: {
      loanStatus?: LoanStatus;
      commissionAmount?: number;
      account1150Exists?: boolean;
      account4300Exists?: boolean;
      updateManyCount?: number;
      glServiceShouldFail?: boolean;
    }) => {
      const loanStatus = options.loanStatus ?? LoanStatus.SANCTIONED;
      const commissionAmount = options.commissionAmount ?? 10000;
      const account1150Exists = options.account1150Exists ?? true;
      const account4300Exists = options.account4300Exists ?? true;
      const updateManyCount = options.updateManyCount ?? 1;
      const glServiceShouldFail = options.glServiceShouldFail ?? false;

      let journalEntryCreated: any = null;
      let transactionExecuted = false;
      let loanUpdatedStatus: LoanStatus | null = null;

      const mockLoanRecord = {
        ...sampleLoan,
        id: 'loan-gl-test-1',
        status: loanStatus,
        commissionAmount,
      };

      const mockTx: any = {
        loanApplication: {
          updateMany: async ({ data }: any) => {
            if (updateManyCount === 1) {
              loanUpdatedStatus = data.status;
            }
            return { count: updateManyCount };
          },
          findUniqueOrThrow: async () => ({
            ...mockLoanRecord,
            status: loanUpdatedStatus ?? LoanStatus.DISBURSED,
          }),
        },
        account: {
          findUnique: async ({ where }: any) => {
            if (where.code === '1150') {
              return account1150Exists
                ? { id: 'acc-1150-id', code: '1150', name: 'Lender Commission Receivable', isActive: true, branchId: null }
                : null;
            }
            if (where.code === '4300') {
              return account4300Exists
                ? { id: 'acc-4300-id', code: '4300', name: 'F&I Commission Revenue', isActive: true, branchId: null }
                : null;
            }
            return null;
          },
        },
      };

      const mockPrisma: any = {
        loanApplication: {
          findUnique: async () => mockLoanRecord,
          update: async ({ data }: any) => {
            loanUpdatedStatus = data.status;
            return {
              ...mockLoanRecord,
              status: data.status,
            };
          },
        },
        $transaction: async (callback: any) => {
          transactionExecuted = true;
          return await callback(mockTx);
        },
      };

      const mockGlService: any = {
        createJournalEntry: async (user: any, dto: any, tx: any) => {
          if (glServiceShouldFail) {
            throw new Error('Database connection dropped during GL entry creation');
          }
          journalEntryCreated = { user, dto, tx };
          return { id: 'je-1', ...dto };
        },
      };

      const service = new FinanceLoanService(mockPrisma, mockGlService);

      return {
        service,
        mockLoanRecord,
        mockGlService,
        mockPrisma,
        mockTx,
        getJournalEntryCreated: () => journalEntryCreated,
        getTransactionExecuted: () => transactionExecuted,
        getLoanUpdatedStatus: () => loanUpdatedStatus,
      };
    };

    it('should NOT post to GL when ENABLE_GL_POSTING is false or unset (default behavior)', async () => {
      delete process.env.ENABLE_GL_POSTING;
      const ctx = setupGlTestContext({});

      const result = await ctx.service.updateStatus(mockFinanceManagerUser, 'loan-gl-test-1', {
        status: LoanStatus.DISBURSED,
      });

      assert.strictEqual(result.status, LoanStatus.DISBURSED);
      assert.strictEqual(ctx.getTransactionExecuted(), false);
      assert.strictEqual(ctx.getJournalEntryCreated(), null);
    });

    it('should post balanced journal entry to GL on disbursement when ENABLE_GL_POSTING is true', async () => {
      process.env.ENABLE_GL_POSTING = 'true';
      try {
        const ctx = setupGlTestContext({ commissionAmount: 10000 });

        const result = await ctx.service.updateStatus(mockFinanceManagerUser, 'loan-gl-test-1', {
          status: LoanStatus.DISBURSED,
        });

        assert.strictEqual(result.status, LoanStatus.DISBURSED);
        assert.strictEqual(ctx.getTransactionExecuted(), true);
        const je = ctx.getJournalEntryCreated();
        assert.ok(je);
        assert.strictEqual(je.dto.branchId, 'branch-mumbai');
        assert.strictEqual(je.dto.sourceModule, 'FINANCE_LOAN');
        assert.strictEqual(je.dto.sourceReference, 'loan-gl-test-1');
        assert.strictEqual(je.dto.lines.length, 2);

        // Debit Receivable (1150)
        assert.strictEqual(je.dto.lines[0].accountId, 'acc-1150-id');
        assert.strictEqual(je.dto.lines[0].debitAmount, 10000);
        assert.strictEqual(je.dto.lines[0].creditAmount, 0);

        // Credit Revenue (4300)
        assert.strictEqual(je.dto.lines[1].accountId, 'acc-4300-id');
        assert.strictEqual(je.dto.lines[1].debitAmount, 0);
        assert.strictEqual(je.dto.lines[1].creditAmount, 10000);
      } finally {
        if (originalEnv !== undefined) {
          process.env.ENABLE_GL_POSTING = originalEnv;
        } else {
          delete process.env.ENABLE_GL_POSTING;
        }
      }
    });

    it('should handle fractional commission in cents correctly (e.g. 100001 * 2% = 2000.02)', async () => {
      process.env.ENABLE_GL_POSTING = 'true';
      try {
        // Commission amount = 2000.02 (e.g., from loanAmount: 100001)
        const ctx = setupGlTestContext({ commissionAmount: 2000.02 });

        const result = await ctx.service.updateStatus(mockFinanceManagerUser, 'loan-gl-test-1', {
          status: LoanStatus.DISBURSED,
        });

        assert.strictEqual(result.status, LoanStatus.DISBURSED);
        const je = ctx.getJournalEntryCreated();
        assert.ok(je);
        assert.strictEqual(je.dto.lines[0].debitAmount, 2000.02);
        assert.strictEqual(je.dto.lines[1].creditAmount, 2000.02);
      } finally {
        if (originalEnv !== undefined) {
          process.env.ENABLE_GL_POSTING = originalEnv;
        } else {
          delete process.env.ENABLE_GL_POSTING;
        }
      }
    });

    it('should skip GL journal entry creation when commissionAmount is 0', async () => {
      process.env.ENABLE_GL_POSTING = 'true';
      try {
        const ctx = setupGlTestContext({ commissionAmount: 0 });

        const result = await ctx.service.updateStatus(mockFinanceManagerUser, 'loan-gl-test-1', {
          status: LoanStatus.DISBURSED,
        });

        assert.strictEqual(result.status, LoanStatus.DISBURSED);
        assert.strictEqual(ctx.getTransactionExecuted(), true);
        assert.strictEqual(ctx.getJournalEntryCreated(), null);
      } finally {
        if (originalEnv !== undefined) {
          process.env.ENABLE_GL_POSTING = originalEnv;
        } else {
          delete process.env.ENABLE_GL_POSTING;
        }
      }
    });

    it('should reject and abort transaction if loan is not in SANCTIONED status upon atomic update (concurrency guard)', async () => {
      process.env.ENABLE_GL_POSTING = 'true';
      try {
        // updateMany returns count 0 (e.g. concurrent modification changed status away from SANCTIONED)
        const ctx = setupGlTestContext({ updateManyCount: 0 });

        await assert.rejects(
          async () => {
            await ctx.service.updateStatus(mockFinanceManagerUser, 'loan-gl-test-1', {
              status: LoanStatus.DISBURSED,
            });
          },
          (err: any) => {
            assert.ok(err instanceof BadRequestException);
            assert.match(err.message, /is not in SANCTIONED status or was concurrently modified/);
            return true;
          },
        );
        assert.strictEqual(ctx.getJournalEntryCreated(), null);
      } finally {
        if (originalEnv !== undefined) {
          process.env.ENABLE_GL_POSTING = originalEnv;
        } else {
          delete process.env.ENABLE_GL_POSTING;
        }
      }
    });

    it('should rollback and reject when provisional accounts are missing', async () => {
      process.env.ENABLE_GL_POSTING = 'true';
      try {
        const ctx = setupGlTestContext({ account1150Exists: false });

        await assert.rejects(
          async () => {
            await ctx.service.updateStatus(mockFinanceManagerUser, 'loan-gl-test-1', {
              status: LoanStatus.DISBURSED,
            });
          },
          (err: any) => {
            assert.ok(err instanceof BadRequestException);
            assert.match(err.message, /GL Account with code '1150' not found/);
            return true;
          },
        );
        assert.strictEqual(ctx.getJournalEntryCreated(), null);
      } finally {
        if (originalEnv !== undefined) {
          process.env.ENABLE_GL_POSTING = originalEnv;
        } else {
          delete process.env.ENABLE_GL_POSTING;
        }
      }
    });

    it('should rollback transaction if GL service createJournalEntry fails', async () => {
      process.env.ENABLE_GL_POSTING = 'true';
      try {
        const ctx = setupGlTestContext({ glServiceShouldFail: true });

        await assert.rejects(
          async () => {
            await ctx.service.updateStatus(mockFinanceManagerUser, 'loan-gl-test-1', {
              status: LoanStatus.DISBURSED,
            });
          },
          (err: any) => {
            assert.ok(err instanceof Error);
            return true;
          },
        );
      } finally {
        if (originalEnv !== undefined) {
          process.env.ENABLE_GL_POSTING = originalEnv;
        } else {
          delete process.env.ENABLE_GL_POSTING;
        }
      }
    });
  });
});
