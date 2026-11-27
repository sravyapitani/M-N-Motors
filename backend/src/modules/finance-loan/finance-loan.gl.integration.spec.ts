import 'dotenv/config';
import * as crypto from 'node:crypto';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceLoanService } from './finance-loan.service';
import { GeneralLedgerService } from '../general-ledger/general-ledger.service';
import { LoanStatus, JournalStatus, AccountType } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

describe('FinanceLoanService — Real Database GL Integration Tests (ENABLE_GL_POSTING)', () => {
  let prisma: PrismaService;
  let glService: GeneralLedgerService;
  let loanService: FinanceLoanService;

  const originalFlag = process.env.ENABLE_GL_POSTING;
  const testRunId = crypto.randomBytes(4).toString('hex');
  const testPrefix = `GLINT_${testRunId}_`;

  let testBranch: { id: string; code: string; name: string };
  let fmDbUser: { id: string; email: string };
  let fmUser: AuthenticatedUser;

  // Track created entity IDs for safe cleanup
  const createdLoanIds: string[] = [];
  const createdJournalEntryIds: string[] = [];
  const createdBranchIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdAccountIds: string[] = [];
  const createdRoleIds: string[] = [];
  const createdPermissionIds: string[] = [];
  const createdRolePermissionKeys: Array<{ roleId: string; permissionId: string }> = [];

  let baselineLoans = 0;
  let baselineEntries = 0;

  before(async () => {
    // Enable GL posting feature flag for integration tests
    process.env.ENABLE_GL_POSTING = 'true';

    prisma = new PrismaService();
    await prisma.$connect();
    glService = new GeneralLedgerService(prisma);
    loanService = new FinanceLoanService(prisma, glService);

    baselineLoans = await prisma.loanApplication.count();
    baselineEntries = await prisma.journalEntry.count();

    // 1. Ensure required provisional accounts exist (1150 and 4300)
    let acc1150 = await prisma.account.findUnique({ where: { code: '1150' } });
    if (!acc1150) {
      acc1150 = await prisma.account.create({
        data: {
          code: '1150',
          name: 'PROVISIONAL - Lender Commission Receivable',
          type: AccountType.ASSET,
          description: 'PROVISIONAL - Temporary asset account for test run',
          isActive: true,
          branchId: null,
        },
      });
      createdAccountIds.push(acc1150.id);
    } else if (!acc1150.isActive) {
      await prisma.account.update({ where: { id: acc1150.id }, data: { isActive: true } });
    }

    let acc4300 = await prisma.account.findUnique({ where: { code: '4300' } });
    if (!acc4300) {
      acc4300 = await prisma.account.create({
        data: {
          code: '4300',
          name: 'PROVISIONAL - F&I Commission Revenue',
          type: AccountType.REVENUE,
          description: 'PROVISIONAL - Temporary revenue account for test run',
          isActive: true,
          branchId: null,
        },
      });
      createdAccountIds.push(acc4300.id);
    } else if (!acc4300.isActive) {
      await prisma.account.update({ where: { id: acc4300.id }, data: { isActive: true } });
    }

    // 2. Ensure permissions and role exist
    let approvePerm = await prisma.permission.findUnique({ where: { key: 'LOAN_APPROVE' } });
    if (!approvePerm) {
      approvePerm = await prisma.permission.create({
        data: { key: 'LOAN_APPROVE', description: 'Test Permission to Approve Loans' },
      });
      createdPermissionIds.push(approvePerm.id);
    }

    let disbursePerm = await prisma.permission.findUnique({ where: { key: 'LOAN_DISBURSE' } });
    if (!disbursePerm) {
      disbursePerm = await prisma.permission.create({
        data: { key: 'LOAN_DISBURSE', description: 'Test Permission to Disburse Loans' },
      });
      createdPermissionIds.push(disbursePerm.id);
    }

    let fmRole = await prisma.role.findUnique({ where: { key: 'FINANCE_MANAGER' } });
    if (!fmRole) {
      fmRole = await prisma.role.create({
        data: { key: 'FINANCE_MANAGER', name: 'Finance Manager' },
      });
      createdRoleIds.push(fmRole.id);
    }

    const existingApproveLink = await prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId: fmRole.id, permissionId: approvePerm.id } },
    });
    if (!existingApproveLink) {
      await prisma.rolePermission.create({
        data: { roleId: fmRole.id, permissionId: approvePerm.id },
      });
      createdRolePermissionKeys.push({ roleId: fmRole.id, permissionId: approvePerm.id });
    }

    const existingDisburseLink = await prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId: fmRole.id, permissionId: disbursePerm.id } },
    });
    if (!existingDisburseLink) {
      await prisma.rolePermission.create({
        data: { roleId: fmRole.id, permissionId: disbursePerm.id },
      });
      createdRolePermissionKeys.push({ roleId: fmRole.id, permissionId: disbursePerm.id });
    }

    // 3. Create isolated test branch
    testBranch = await prisma.branch.create({
      data: {
        code: `${testPrefix}B1`,
        name: `Test Branch ${testRunId}`,
        isActive: true,
      },
    });
    createdBranchIds.push(testBranch.id);

    // 4. Create Finance Manager user
    fmDbUser = await prisma.user.create({
      data: {
        email: `${testPrefix}fm@test.local`,
        firstName: 'Test',
        lastName: 'FinanceManager',
      },
    });
    createdUserIds.push(fmDbUser.id);

    await prisma.userBranch.create({
      data: { userId: fmDbUser.id, branchId: testBranch.id },
    });
    await prisma.userRole.create({
      data: { userId: fmDbUser.id, roleId: fmRole.id },
    });

    fmUser = {
      userId: fmDbUser.id,
      email: fmDbUser.email,
      department: 'FINANCE',
      roles: ['FINANCE_MANAGER'],
      permissions: ['LOAN_APPROVE', 'LOAN_DISBURSE'],
      branchIds: [testBranch.id],
    };
  });

  after(async () => {
    // Restore original environment variable
    if (originalFlag !== undefined) {
      process.env.ENABLE_GL_POSTING = originalFlag;
    } else {
      delete process.env.ENABLE_GL_POSTING;
    }

    try {
      // 1. Delete created journal entries (cascades to journal lines)
      if (createdJournalEntryIds.length > 0) {
        await prisma.journalEntry.deleteMany({
          where: { id: { in: createdJournalEntryIds } },
        });
      }

      // 2. Delete test loans and their child payout records first to satisfy ON DELETE RESTRICT
      if (createdLoanIds.length > 0) {
        await prisma.loanPayoutReceipt.deleteMany({
          where: { payout: { loanId: { in: createdLoanIds } } },
        });
        await prisma.loanPayoutHistory.deleteMany({
          where: { payout: { loanId: { in: createdLoanIds } } },
        });
        await prisma.loanPayout.deleteMany({
          where: { loanId: { in: createdLoanIds } },
        });
        await prisma.loanApplication.deleteMany({
          where: { id: { in: createdLoanIds } },
        });
      }

      // 3. Delete users and branch links
      if (createdUserIds.length > 0) {
        await prisma.userBranch.deleteMany({
          where: { userId: { in: createdUserIds } },
        });
        await prisma.userRole.deleteMany({
          where: { userId: { in: createdUserIds } },
        });
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
      }

      // 4. Delete test branches
      if (createdBranchIds.length > 0) {
        await prisma.branch.deleteMany({
          where: { id: { in: createdBranchIds } },
        });
      }

      // 5. Delete role permissions and roles created strictly in this test run
      for (const link of createdRolePermissionKeys) {
        await prisma.rolePermission.deleteMany({
          where: { roleId: link.roleId, permissionId: link.permissionId },
        });
      }
      if (createdRoleIds.length > 0) {
        await prisma.role.deleteMany({
          where: { id: { in: createdRoleIds } },
        });
      }
      if (createdPermissionIds.length > 0) {
        await prisma.permission.deleteMany({
          where: { id: { in: createdPermissionIds } },
        });
      }

      // 6. Delete provisional accounts ONLY if created by this test run
      if (createdAccountIds.length > 0) {
        await prisma.account.deleteMany({
          where: { id: { in: createdAccountIds } },
        });
      }

      // Verify no test records remain
      const remainingBranches = await prisma.branch.count({
        where: { code: { startsWith: testPrefix } },
      });
      const remainingUsers = await prisma.user.count({
        where: { email: { startsWith: testPrefix } },
      });
      const remainingLoans = await prisma.loanApplication.count({
        where: { id: { in: createdLoanIds } },
      });
      const remainingEntries = await prisma.journalEntry.count({
        where: { id: { in: createdJournalEntryIds } },
      });

      assert.strictEqual(remainingBranches, 0, 'No test branches should remain');
      assert.strictEqual(remainingUsers, 0, 'No test users should remain');
      assert.strictEqual(remainingLoans, 0, 'No test loans should remain');
      assert.strictEqual(remainingEntries, 0, 'No test journal entries should remain');

      const afterLoans = await prisma.loanApplication.count();
      const afterEntries = await prisma.journalEntry.count();
      console.log(
        `[GL Integration Teardown] Cleaned up test run ${testRunId}. Pre-existing loans: ${baselineLoans} -> ${afterLoans}, Pre-existing journal entries: ${baselineEntries} -> ${afterEntries}.`,
      );
    } catch (cleanupErr) {
      console.error('[GL Integration Teardown Error]', cleanupErr);
    } finally {
      if (prisma) {
        await prisma.$disconnect();
      }
    }
  });

  async function createTestLoan(customerSuffix: string, loanAmount: number, commission?: number) {
    const loan = await prisma.loanApplication.create({
      data: {
        customerName: `${testPrefix}Customer_${customerSuffix}`,
        lenderName: 'HDFC Bank',
        loanAmount,
        interestRate: 9.5,
        tenureMonths: 36,
        commissionAmount: commission !== undefined ? commission : Math.round(loanAmount * 0.02 * 100) / 100,
        status: LoanStatus.SANCTIONED,
        branchId: testBranch.id,
        submittingUserId: fmDbUser.id,
      },
    });
    createdLoanIds.push(loan.id);
    return loan;
  }

  it('1. Disbursement with ENABLE_GL_POSTING=true creates 1 POSTED journal entry with balanced lines in cents', async () => {
    // 100001 amount at 2% = 2000.02 fractional commission cents
    const loan = await createTestLoan('fractional', 100001, 2000.02);

    const disbursedLoan = await loanService.updateStatus(fmUser, loan.id, {
      status: LoanStatus.DISBURSED,
    });
    assert.strictEqual(disbursedLoan.status, LoanStatus.DISBURSED);

    // Verify in database
    const dbLoan = await prisma.loanApplication.findUnique({ where: { id: loan.id } });
    assert.strictEqual(dbLoan?.status, LoanStatus.DISBURSED);

    // Verify exactly one journal entry exists for this loan
    const journalEntry = await prisma.journalEntry.findUnique({
      where: {
        sourceModule_sourceReference: {
          sourceModule: 'FINANCE_LOAN',
          sourceReference: loan.id,
        },
      },
      include: {
        lines: {
          include: { account: true },
        },
      },
    });

    assert.ok(journalEntry, 'Journal entry must be created in database');
    createdJournalEntryIds.push(journalEntry.id);

    assert.strictEqual(journalEntry.status, JournalStatus.POSTED);
    assert.strictEqual(journalEntry.branchId, testBranch.id);
    assert.match(journalEntry.narration, new RegExp(loan.id));
    assert.strictEqual(journalEntry.lines.length, 2);

    const debitLine = journalEntry.lines.find((l) => Number(l.debitAmount) > 0);
    const creditLine = journalEntry.lines.find((l) => Number(l.creditAmount) > 0);

    assert.ok(debitLine, 'Debit line must exist');
    assert.ok(creditLine, 'Credit line must exist');

    // Integer cents conversion verification (2000.02)
    assert.strictEqual(Number(debitLine.debitAmount), 2000.02);
    assert.strictEqual(Number(debitLine.creditAmount), 0);
    assert.strictEqual(debitLine.account.code, '1150');

    assert.strictEqual(Number(creditLine.creditAmount), 2000.02);
    assert.strictEqual(Number(creditLine.debitAmount), 0);
    assert.strictEqual(creditLine.account.code, '4300');
  });

  it('2. Disbursement with zero commission skips journal entry creation', async () => {
    const loan = await createTestLoan('zero_comm', 500000, 0);

    const disbursedLoan = await loanService.updateStatus(fmUser, loan.id, {
      status: LoanStatus.DISBURSED,
    });
    assert.strictEqual(disbursedLoan.status, LoanStatus.DISBURSED);

    const dbLoan = await prisma.loanApplication.findUnique({ where: { id: loan.id } });
    assert.strictEqual(dbLoan?.status, LoanStatus.DISBURSED);

    // Verify NO journal entry exists
    const journalEntry = await prisma.journalEntry.findUnique({
      where: {
        sourceModule_sourceReference: {
          sourceModule: 'FINANCE_LOAN',
          sourceReference: loan.id,
        },
      },
    });
    assert.strictEqual(journalEntry, null, 'No journal entry should exist for zero commission');
  });

  it('3. Concurrency guard: re-reads and rejects if status is not SANCTIONED upon atomic update', async () => {
    const loan = await createTestLoan('concurrency', 400000, 8000);

    // Concurrently change loan status in DB to REJECTED
    await prisma.loanApplication.update({
      where: { id: loan.id },
      data: { status: LoanStatus.REJECTED },
    });

    // Intercept findUnique on this loan to simulate race condition where initial pre-check
    // saw SANCTIONED right before concurrent commit changed it to REJECTED
    const originalFindUnique = prisma.loanApplication.findUnique.bind(prisma.loanApplication);
    (prisma.loanApplication as any).findUnique = async (args: any) => {
      const real = await originalFindUnique(args);
      if (args.where?.id === loan.id && real?.status === LoanStatus.REJECTED) {
        return { ...real, status: LoanStatus.SANCTIONED };
      }
      return real;
    };

    try {
      // Now attempt to disburse — the atomic updateMany detects count === 0
      await assert.rejects(
        async () => {
          await loanService.updateStatus(fmUser, loan.id, {
            status: LoanStatus.DISBURSED,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestException);
          assert.match(
            (err as BadRequestException).message,
            /is not in SANCTIONED status or was concurrently modified/,
          );
          return true;
        },
      );
    } finally {
      (prisma.loanApplication as any).findUnique = originalFindUnique;
    }

    // Verify DB loan remained REJECTED
    const dbLoan = await prisma.loanApplication.findUnique({ where: { id: loan.id } });
    assert.strictEqual(dbLoan?.status, LoanStatus.REJECTED);

    // Verify no journal entry was created
    const journalEntry = await prisma.journalEntry.findUnique({
      where: {
        sourceModule_sourceReference: {
          sourceModule: 'FINANCE_LOAN',
          sourceReference: loan.id,
        },
      },
    });
    assert.strictEqual(journalEntry, null);
  });

  it('4. Forced failure rolls back transaction: loan stays SANCTIONED and 0 entries created', async () => {
    const loan = await createTestLoan('rollback', 300000, 6000);

    // Temporarily mark account 1150 as inactive to trigger resolver failure inside transaction
    await prisma.account.update({
      where: { code: '1150' },
      data: { isActive: false },
    });

    try {
      await assert.rejects(
        async () => {
          await loanService.updateStatus(fmUser, loan.id, {
            status: LoanStatus.DISBURSED,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestException);
          assert.match((err as BadRequestException).message, /is inactive/);
          return true;
        },
      );
    } finally {
      // Re-activate account 1150
      await prisma.account.update({
        where: { code: '1150' },
        data: { isActive: true },
      });
    }

    // Verify loan is STILL SANCTIONED (transaction rolled back)
    const dbLoan = await prisma.loanApplication.findUnique({ where: { id: loan.id } });
    assert.strictEqual(dbLoan?.status, LoanStatus.SANCTIONED, 'Loan must remain SANCTIONED on failure');

    // Verify 0 journal entries exist
    const journalEntry = await prisma.journalEntry.findUnique({
      where: {
        sourceModule_sourceReference: {
          sourceModule: 'FINANCE_LOAN',
          sourceReference: loan.id,
        },
      },
    });
    assert.strictEqual(journalEntry, null, 'No journal entry should exist after rollback');
  });

  it('5. Unique constraint safeguard prevents duplicate GL journal entries for same loan', async () => {
    const loan = await createTestLoan('dup_guard', 250000, 5000);

    // First disbursement creates the entry
    const disbursed = await loanService.updateStatus(fmUser, loan.id, {
      status: LoanStatus.DISBURSED,
    });
    assert.strictEqual(disbursed.status, LoanStatus.DISBURSED);

    const firstEntry = await prisma.journalEntry.findUnique({
      where: {
        sourceModule_sourceReference: {
          sourceModule: 'FINANCE_LOAN',
          sourceReference: loan.id,
        },
      },
    });
    assert.ok(firstEntry);
    createdJournalEntryIds.push(firstEntry.id);

    // Direct attempt to create duplicate journal entry with same sourceModule and sourceReference throws ConflictException
    const { receivableAccountId, revenueAccountId } = {
      receivableAccountId: (await prisma.account.findUniqueOrThrow({ where: { code: '1150' } })).id,
      revenueAccountId: (await prisma.account.findUniqueOrThrow({ where: { code: '4300' } })).id,
    };

    await assert.rejects(
      async () => {
        await glService.createJournalEntry(fmUser, {
          branchId: testBranch.id,
          entryDate: new Date(),
          status: JournalStatus.POSTED,
          sourceModule: 'FINANCE_LOAN',
          sourceReference: loan.id,
          narration: 'Duplicate attempt test',
          lines: [
            { accountId: receivableAccountId, debitAmount: 5000, creditAmount: 0 },
            { accountId: revenueAccountId, debitAmount: 0, creditAmount: 5000 },
          ],
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ConflictException);
        assert.match((err as ConflictException).message, /already exists/);
        return true;
      },
    );
  });
});
