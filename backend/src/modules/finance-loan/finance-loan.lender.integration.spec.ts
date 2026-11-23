import 'dotenv/config';
import * as crypto from 'node:crypto';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceLoanService } from './finance-loan.service';
import { GeneralLedgerService } from '../general-ledger/general-ledger.service';
import { LenderType } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

describe('FinanceLoanService — Real Database Lender Master Integration Tests', () => {
  let prisma: PrismaService;
  let loanService: FinanceLoanService;

  const testRunId = crypto.randomBytes(4).toString('hex');
  const testPrefix = `LNDR_${testRunId}_`;

  let testBranch: { id: string; code: string; name: string };
  let testDbUser: { id: string; email: string };
  let testUser: AuthenticatedUser;

  let activeLender: { id: string; name: string; tallyLedgerName: string };
  let inactiveLender: { id: string; name: string; tallyLedgerName: string };

  const createdLoanIds: string[] = [];
  const createdBranchIds: string[] = [];
  const createdUserIds: string[] = [];

  let baselineLoans = 0;

  before(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const glService = new GeneralLedgerService(prisma);
    loanService = new FinanceLoanService(prisma, glService);

    baselineLoans = await prisma.loanApplication.count();

    // 1. Fetch seeded active and inactive lenders
    const hdfc = await prisma.lender.findFirst({
      where: { tallyLedgerName: 'HDFC Bank Finance Payouts' },
    });
    assert.ok(hdfc, 'Seeded HDFC Bank lender must exist');
    activeLender = hdfc;

    const inactive = await prisma.lender.findFirst({
      where: { isActive: false },
    });
    assert.ok(inactive, 'Seeded inactive lender must exist');
    inactiveLender = inactive;

    // 2. Create isolated test branch
    testBranch = await prisma.branch.create({
      data: {
        code: `${testPrefix}B1`,
        name: `Test Branch ${testRunId}`,
        isActive: true,
      },
    });
    createdBranchIds.push(testBranch.id);

    // 3. Create test staff user
    testDbUser = await prisma.user.create({
      data: {
        email: `${testPrefix}user@test.local`,
        firstName: 'Test',
        lastName: 'LoanOfficer',
      },
    });
    createdUserIds.push(testDbUser.id);

    await prisma.userBranch.create({
      data: { userId: testDbUser.id, branchId: testBranch.id },
    });

    testUser = {
      userId: testDbUser.id,
      email: testDbUser.email,
      department: 'FINANCE',
      roles: [],
      permissions: [],
      branchIds: [testBranch.id],
    };
  });

  after(async () => {
    try {
      // 1. Delete created test loans
      if (createdLoanIds.length > 0) {
        await prisma.loanApplication.deleteMany({
          where: { id: { in: createdLoanIds } },
        });
      }

      // 2. Delete test user and branch associations
      if (createdUserIds.length > 0) {
        await prisma.userBranch.deleteMany({
          where: { userId: { in: createdUserIds } },
        });
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
      }

      // 3. Delete test branch
      if (createdBranchIds.length > 0) {
        await prisma.branch.deleteMany({
          where: { id: { in: createdBranchIds } },
        });
      }

      const postLoans = await prisma.loanApplication.count();
      console.log(
        `[Lender Integration Teardown] Cleaned up run ${testRunId}. Baseline loans: ${baselineLoans} -> Post-teardown loans: ${postLoans}.`
      );
    } finally {
      await prisma.$disconnect();
    }
  });

  it('1. List lenders and verify filtering by isActive, type, and search', async () => {
    const allLenders = await loanService.findAllLenders({});
    assert.ok(allLenders.length >= 36);

    const activeOnly = await loanService.findAllLenders({ isActive: true });
    assert.ok(activeOnly.every((l) => l.isActive === true));
    assert.ok(activeOnly.length >= 29);

    const banksOnly = await loanService.findAllLenders({ type: LenderType.BANK });
    assert.ok(banksOnly.every((l) => l.type === LenderType.BANK));

    const searched = await loanService.findAllLenders({ search: 'Telangana' });
    assert.ok(searched.length >= 2);
    assert.ok(
      searched.every(
        (l) => l.name.includes('Telangana') || l.tallyLedgerName.includes('Telangana')
      )
    );
  });

  it('2. Create loan with valid active lenderId: persists lenderId and matches lenderName', async () => {
    const created = await loanService.create(testUser, {
      customerName: 'Kavitha Devi',
      lenderId: activeLender.id,
      loanAmount: 600000,
      interestRate: 8.75,
      tenureMonths: 48,
      branchId: testBranch.id,
    });

    createdLoanIds.push(created.id);

    assert.strictEqual(created.lenderId, activeLender.id);
    assert.strictEqual(created.lenderName, activeLender.name);

    // Verify persisted directly in PostgreSQL
    const persisted = await prisma.loanApplication.findUnique({
      where: { id: created.id },
      include: { lender: true },
    });

    assert.ok(persisted);
    assert.strictEqual(persisted.lenderId, activeLender.id);
    assert.strictEqual(persisted.lenderName, activeLender.name);
    assert.strictEqual(persisted.lender?.tallyLedgerName, activeLender.tallyLedgerName);
  });

  it('3. Create loan with inactive lenderId: rejected with BadRequestException', async () => {
    await assert.rejects(
      async () => {
        await loanService.create(testUser, {
          customerName: 'Inactive Test Customer',
          lenderId: inactiveLender.id,
          loanAmount: 500000,
          interestRate: 9.0,
          tenureMonths: 36,
          branchId: testBranch.id,
        });
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestException);
        assert.match(err.message, /is invalid or inactive/);
        return true;
      }
    );
  });

  it('4. Create loan with non-existent lenderId: rejected with BadRequestException', async () => {
    await assert.rejects(
      async () => {
        await loanService.create(testUser, {
          customerName: 'NonExistent Lender Customer',
          lenderId: 'c_non_existent_lender_id_999',
          loanAmount: 500000,
          interestRate: 9.0,
          tenureMonths: 36,
          branchId: testBranch.id,
        });
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestException);
        assert.match(err.message, /is invalid or inactive/);
        return true;
      }
    );
  });

  it('5. Backward compatibility: loan created with only lenderName matching active lender auto-links lenderId', async () => {
    const created = await loanService.create(testUser, {
      customerName: 'AutoLink Customer',
      lenderName: activeLender.name,
      loanAmount: 450000,
      interestRate: 9.5,
      tenureMonths: 24,
      branchId: testBranch.id,
    });

    createdLoanIds.push(created.id);

    assert.strictEqual(created.lenderId, activeLender.id);
    assert.strictEqual(created.lenderName, activeLender.name);
  });

  it('6. Backward compatibility: loan created with custom/unknown lenderName succeeds with lenderId: null', async () => {
    const created = await loanService.create(testUser, {
      customerName: 'Custom Lender Customer',
      lenderName: 'Local Finance Co-op',
      loanAmount: 250000,
      interestRate: 11.0,
      tenureMonths: 18,
      branchId: testBranch.id,
    });

    createdLoanIds.push(created.id);

    assert.strictEqual(created.lenderId, null);
    assert.strictEqual(created.lenderName, 'Local Finance Co-op');

    const persisted = await prisma.loanApplication.findUnique({
      where: { id: created.id },
    });
    assert.ok(persisted);
    assert.strictEqual(persisted.lenderId, null);
    assert.strictEqual(persisted.lenderName, 'Local Finance Co-op');
  });
});

