import 'dotenv/config';
import * as crypto from 'node:crypto';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceLoanService } from './finance-loan.service';
import { LoanStatus } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

describe('FinanceLoanService — Real Database RBAC Integration Tests', () => {
  let prisma: PrismaService;
  let loanService: FinanceLoanService;

  const testRunId = crypto.randomBytes(4).toString('hex');
  const testPrefix = `RBAC_${testRunId}_`;

  let testBranch1: { id: string; code: string; name: string };
  let testBranch2: { id: string; code: string; name: string };
  let officerDbUser: { id: string; email: string };
  let fmDbUser: { id: string; email: string };
  let adminDbUser: { id: string; email: string };

  let officerUser: AuthenticatedUser;
  let fmUser: AuthenticatedUser;
  let adminUser: AuthenticatedUser;

  // Track created entity IDs for safe cleanup
  const createdLoanIds: string[] = [];
  const createdBranchIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdRoleIds: string[] = [];
  const createdPermissionIds: string[] = [];
  const createdRolePermissionKeys: Array<{ roleId: string; permissionId: string }> = [];

  let baselineBranches = 0;
  let baselineUsers = 0;
  let baselineLoans = 0;

  before(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    loanService = new FinanceLoanService(prisma);

    // Record baseline row counts for logging in teardown
    baselineBranches = await prisma.branch.count();
    baselineUsers = await prisma.user.count();
    baselineLoans = await prisma.loanApplication.count();

    // 1. Ensure permissions exist (track for teardown only if created here)
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

    // 2. Ensure role FINANCE_MANAGER exists (track for teardown only if created here)
    let fmRole = await prisma.role.findUnique({ where: { key: 'FINANCE_MANAGER' } });
    if (!fmRole) {
      fmRole = await prisma.role.create({
        data: { key: 'FINANCE_MANAGER', name: 'Finance Manager' },
      });
      createdRoleIds.push(fmRole.id);
    }

    // 3. Link permissions to role if not already linked
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

    // 4. Create isolated test branches
    testBranch1 = await prisma.branch.create({
      data: {
        code: `${testPrefix}B1`,
        name: `Test Branch 1 (${testRunId})`,
      },
    });
    createdBranchIds.push(testBranch1.id);

    testBranch2 = await prisma.branch.create({
      data: {
        code: `${testPrefix}B2`,
        name: `Test Branch 2 (${testRunId})`,
      },
    });
    createdBranchIds.push(testBranch2.id);

    // 5. Create isolated officer user (no roles) in testBranch1
    officerDbUser = await prisma.user.create({
      data: {
        email: `${testPrefix}officer@test.local`,
        firstName: 'Test',
        lastName: 'Officer',
      },
    });
    createdUserIds.push(officerDbUser.id);
    await prisma.userBranch.create({
      data: {
        userId: officerDbUser.id,
        branchId: testBranch1.id,
      },
    });

    // 6. Create isolated finance manager user in testBranch1
    fmDbUser = await prisma.user.create({
      data: {
        email: `${testPrefix}fm@test.local`,
        firstName: 'Test',
        lastName: 'FinanceManager',
      },
    });
    createdUserIds.push(fmDbUser.id);
    await prisma.userBranch.create({
      data: {
        userId: fmDbUser.id,
        branchId: testBranch1.id,
      },
    });
    await prisma.userRole.create({
      data: {
        userId: fmDbUser.id,
        roleId: fmRole.id,
      },
    });

    // 7. Create isolated admin user in DB for audit FK references
    adminDbUser = await prisma.user.create({
      data: {
        email: `${testPrefix}admin@test.local`,
        firstName: 'Test',
        lastName: 'Admin',
      },
    });
    createdUserIds.push(adminDbUser.id);

    // 8. Construct AuthenticatedUser contexts directly
    officerUser = {
      userId: officerDbUser.id,
      email: officerDbUser.email,
      department: 'FINANCE',
      roles: [],
      permissions: [],
      branchIds: [testBranch1.id],
    };

    fmUser = {
      userId: fmDbUser.id,
      email: fmDbUser.email,
      department: 'FINANCE',
      roles: ['FINANCE_MANAGER'],
      permissions: ['LOAN_APPROVE', 'LOAN_DISBURSE'],
      branchIds: [testBranch1.id],
    };

    adminUser = {
      userId: adminDbUser.id,
      email: adminDbUser.email,
      department: 'FINANCE',
      roles: ['SYSTEM_ADMIN'],
      permissions: [],
      branchIds: [testBranch1.id, testBranch2.id],
    };
  });

  after(async () => {
    try {
      if (createdLoanIds.length > 0) {
        await prisma.loanApplication.deleteMany({
          where: { id: { in: createdLoanIds } },
        });
      }

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

      if (createdBranchIds.length > 0) {
        await prisma.branch.deleteMany({
          where: { id: { in: createdBranchIds } },
        });
      }

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

      // Assert no test rows remain
      const remainingBranches = await prisma.branch.count({
        where: { code: { startsWith: testPrefix } },
      });
      assert.strictEqual(remainingBranches, 0, 'No test branches should remain after teardown');

      const remainingUsers = await prisma.user.count({
        where: { email: { startsWith: testPrefix } },
      });
      assert.strictEqual(remainingUsers, 0, 'No test users should remain after teardown');

      const remainingLoans = await prisma.loanApplication.count({
        where: { customerName: { startsWith: testPrefix } },
      });
      assert.strictEqual(remainingLoans, 0, 'No test loans should remain after teardown');

      // Log any difference in baseline counts
      const finalBranches = await prisma.branch.count();
      const finalUsers = await prisma.user.count();
      const finalLoans = await prisma.loanApplication.count();
      if (
        finalBranches !== baselineBranches ||
        finalUsers !== baselineUsers ||
        finalLoans !== baselineLoans
      ) {
        console.log(
          `[Teardown Info] Pre-existing baseline counts: Branches ${baselineBranches}->${finalBranches}, Users ${baselineUsers}->${finalUsers}, Loans ${baselineLoans}->${finalLoans}`,
        );
      }
    } catch (cleanupErr) {
      console.error('Teardown cleanup encountered an error:', cleanupErr);
    } finally {
      await prisma.$disconnect();
    }
  });

  const createTestLoan = async (
    actingUser: AuthenticatedUser,
    branchId: string,
    suffix = 'default',
  ) => {
    const loan = await loanService.create(actingUser, {
      customerName: `${testPrefix}Customer_${suffix}`,
      lenderName: 'HDFC Bank',
      loanAmount: 500000,
      interestRate: 9.5,
      tenureMonths: 48,
      branchId,
    });
    createdLoanIds.push(loan.id);
    return loan;
  };

  it('1. Officer moves a loan ENQUIRY -> SUBMITTED -> UNDER_REVIEW: allowed', async () => {
    const loan = await createTestLoan(officerUser, testBranch1.id, 'case1');
    assert.strictEqual(loan.status, LoanStatus.ENQUIRY);

    const submitted = await loanService.updateStatus(officerUser, loan.id, {
      status: LoanStatus.SUBMITTED,
    });
    assert.strictEqual(submitted.status, LoanStatus.SUBMITTED);

    const underReview = await loanService.updateStatus(officerUser, loan.id, {
      status: LoanStatus.UNDER_REVIEW,
    });
    assert.strictEqual(underReview.status, LoanStatus.UNDER_REVIEW);

    const inDb = await prisma.loanApplication.findUnique({ where: { id: loan.id } });
    assert.strictEqual(inDb?.status, LoanStatus.UNDER_REVIEW);
  });

  it('2. Officer tries UNDER_REVIEW -> SANCTIONED: ForbiddenException (403) and loan stays UNDER_REVIEW', async () => {
    const loan = await createTestLoan(officerUser, testBranch1.id, 'case2');
    await loanService.updateStatus(officerUser, loan.id, { status: LoanStatus.SUBMITTED });
    await loanService.updateStatus(officerUser, loan.id, { status: LoanStatus.UNDER_REVIEW });

    await assert.rejects(
      async () => {
        await loanService.updateStatus(officerUser, loan.id, {
          status: LoanStatus.SANCTIONED,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenException);
        assert.match((err as ForbiddenException).message, /LOAN_APPROVE/);
        return true;
      },
    );

    const inDb = await prisma.loanApplication.findUnique({ where: { id: loan.id } });
    assert.strictEqual(inDb?.status, LoanStatus.UNDER_REVIEW);
  });

  it('3. Finance manager moves UNDER_REVIEW -> SANCTIONED -> DISBURSED: allowed, DB shows DISBURSED', async () => {
    const loan = await createTestLoan(fmUser, testBranch1.id, 'case3');
    await loanService.updateStatus(fmUser, loan.id, { status: LoanStatus.SUBMITTED });
    await loanService.updateStatus(fmUser, loan.id, { status: LoanStatus.UNDER_REVIEW });

    const sanctioned = await loanService.updateStatus(fmUser, loan.id, {
      status: LoanStatus.SANCTIONED,
    });
    assert.strictEqual(sanctioned.status, LoanStatus.SANCTIONED);

    const disbursed = await loanService.updateStatus(fmUser, loan.id, {
      status: LoanStatus.DISBURSED,
    });
    assert.strictEqual(disbursed.status, LoanStatus.DISBURSED);

    const inDb = await prisma.loanApplication.findUnique({ where: { id: loan.id } });
    assert.strictEqual(inDb?.status, LoanStatus.DISBURSED);
  });

  it('4. Officer tries SANCTIONED -> DISBURSED: ForbiddenException and loan stays SANCTIONED', async () => {
    const loan = await createTestLoan(fmUser, testBranch1.id, 'case4');
    await loanService.updateStatus(fmUser, loan.id, { status: LoanStatus.SUBMITTED });
    await loanService.updateStatus(fmUser, loan.id, { status: LoanStatus.UNDER_REVIEW });
    await loanService.updateStatus(fmUser, loan.id, { status: LoanStatus.SANCTIONED });

    await assert.rejects(
      async () => {
        await loanService.updateStatus(officerUser, loan.id, {
          status: LoanStatus.DISBURSED,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenException);
        assert.match((err as ForbiddenException).message, /LOAN_DISBURSE/);
        return true;
      },
    );

    const inDb = await prisma.loanApplication.findUnique({ where: { id: loan.id } });
    assert.strictEqual(inDb?.status, LoanStatus.SANCTIONED);
  });

  it('5. SYSTEM_ADMIN can sanction and disburse without individual permissions', async () => {
    const loan = await createTestLoan(adminUser, testBranch1.id, 'case5');
    await loanService.updateStatus(adminUser, loan.id, { status: LoanStatus.SUBMITTED });
    await loanService.updateStatus(adminUser, loan.id, { status: LoanStatus.UNDER_REVIEW });

    const sanctioned = await loanService.updateStatus(adminUser, loan.id, {
      status: LoanStatus.SANCTIONED,
    });
    assert.strictEqual(sanctioned.status, LoanStatus.SANCTIONED);

    const disbursed = await loanService.updateStatus(adminUser, loan.id, {
      status: LoanStatus.DISBURSED,
    });
    assert.strictEqual(disbursed.status, LoanStatus.DISBURSED);

    const inDb = await prisma.loanApplication.findUnique({ where: { id: loan.id } });
    assert.strictEqual(inDb?.status, LoanStatus.DISBURSED);
  });

  it('6. Finance manager acting on a loan in the other branch: ForbiddenException', async () => {
    // Create loan in testBranch2 with adminUser
    const loanBranch2 = await createTestLoan(adminUser, testBranch2.id, 'case6');

    // fmUser belongs only to testBranch1
    await assert.rejects(
      async () => {
        await loanService.updateStatus(fmUser, loanBranch2.id, {
          status: LoanStatus.SUBMITTED,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenException);
        assert.match(
          (err as ForbiddenException).message,
          /You do not have permission to access branch/,
        );
        return true;
      },
    );
  });

  it('7. Invalid jump ENQUIRY -> DISBURSED: BadRequestException (400) comes before permission check', async () => {
    const loan = await createTestLoan(officerUser, testBranch1.id, 'case7');

    // Officer lacks LOAN_DISBURSE, but because transition ENQUIRY -> DISBURSED is invalid,
    // BadRequestException (400) must be thrown instead of ForbiddenException (403)
    await assert.rejects(
      async () => {
        await loanService.updateStatus(officerUser, loan.id, {
          status: LoanStatus.DISBURSED,
        });
      },
      (err: unknown) => {
        assert.ok(
          err instanceof BadRequestException,
          `Expected BadRequestException, got ${(err as Error)?.constructor?.name}`,
        );
        assert.match(
          (err as BadRequestException).message,
          /Invalid status transition from 'ENQUIRY' to 'DISBURSED'/,
        );
        return true;
      },
    );
  });

  it('8. A DISBURSED loan cannot be changed afterwards', async () => {
    const loan = await createTestLoan(fmUser, testBranch1.id, 'case8');
    await loanService.updateStatus(fmUser, loan.id, { status: LoanStatus.SUBMITTED });
    await loanService.updateStatus(fmUser, loan.id, { status: LoanStatus.UNDER_REVIEW });
    await loanService.updateStatus(fmUser, loan.id, { status: LoanStatus.SANCTIONED });
    await loanService.updateStatus(fmUser, loan.id, { status: LoanStatus.DISBURSED });

    // Attempt transition to SANCTIONED
    await assert.rejects(
      async () => {
        await loanService.updateStatus(fmUser, loan.id, {
          status: LoanStatus.SANCTIONED,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof BadRequestException);
        assert.match((err as BadRequestException).message, /terminal state/);
        return true;
      },
    );

    // Attempt transition to REJECTED
    await assert.rejects(
      async () => {
        await loanService.updateStatus(fmUser, loan.id, {
          status: LoanStatus.REJECTED,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof BadRequestException);
        assert.match((err as BadRequestException).message, /terminal state/);
        return true;
      },
    );
  });

  it('9. Officer can reject a loan and a REJECTED loan cannot go directly to SANCTIONED or DISBURSED', async () => {
    const loan = await createTestLoan(officerUser, testBranch1.id, 'case9');

    // Officer rejects loan from ENQUIRY
    const rejected = await loanService.updateStatus(officerUser, loan.id, {
      status: LoanStatus.REJECTED,
    });
    assert.strictEqual(rejected.status, LoanStatus.REJECTED);

    const inDb = await prisma.loanApplication.findUnique({ where: { id: loan.id } });
    assert.strictEqual(inDb?.status, LoanStatus.REJECTED);

    // Directly attempting REJECTED -> SANCTIONED throws BadRequestException
    await assert.rejects(
      async () => {
        await loanService.updateStatus(officerUser, loan.id, {
          status: LoanStatus.SANCTIONED,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof BadRequestException);
        assert.match(
          (err as BadRequestException).message,
          /Invalid status transition from 'REJECTED' to 'SANCTIONED'/,
        );
        return true;
      },
    );

    // Directly attempting REJECTED -> DISBURSED throws BadRequestException even for FM
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
          /Invalid status transition from 'REJECTED' to 'DISBURSED'/,
        );
        return true;
      },
    );

    // REJECTED can be re-opened to ENQUIRY
    const reopened = await loanService.updateStatus(officerUser, loan.id, {
      status: LoanStatus.ENQUIRY,
    });
    assert.strictEqual(reopened.status, LoanStatus.ENQUIRY);

    const inDbReopened = await prisma.loanApplication.findUnique({ where: { id: loan.id } });
    assert.strictEqual(inDbReopened?.status, LoanStatus.ENQUIRY);
  });
});

