import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  ForbiddenException,
} from '@nestjs/common';
import { FinanceLoanService } from './finance-loan.service';
import { LoanStatus } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

describe('FinanceLoanService - Strict Branch Access Enforcement', () => {
  const adminUser: AuthenticatedUser = {
    userId: 'user-admin',
    email: 'admin@nexus.local',
    department: 'FINANCE',
    roles: ['SYSTEM_ADMIN'],
    permissions: [],
    branchIds: ['branch-kkd', 'branch-tnk', 'branch-nrp', 'branch-elr'],
  };

  const kkdBranchUser: AuthenticatedUser = {
    userId: 'user-bharathi',
    email: 'bharathi@nexus.local',
    department: null,
    roles: [],
    permissions: [],
    branchIds: ['branch-kkd'],
  };

  const mockBranch = {
    id: 'branch-kkd',
    code: 'KKD',
    name: 'Kakinada',
    isActive: true,
  };

  const mockTnkBranch = {
    id: 'branch-tnk',
    code: 'TNK',
    name: 'Tanuku',
    isActive: true,
  };

  const kkdLoan = {
    id: 'loan-kkd-1',
    customerName: 'Bharathi Customer',
    lenderName: 'HDFC Bank',
    loanAmount: 500000,
    interestRate: 9.5,
    tenureMonths: 48,
    commissionAmount: 10000,
    status: LoanStatus.ENQUIRY,
    branchId: 'branch-kkd',
    submittingUserId: 'user-bharathi',
    createdAt: new Date(),
    updatedAt: new Date(),
    branch: mockBranch,
    submittingUser: {
      id: 'user-bharathi',
      firstName: 'Bharathi',
      lastName: 'User',
      email: 'bharathi@nexus.local',
    },
  };

  const tnkLoan = {
    id: 'loan-tnk-1',
    customerName: 'Dharshan Customer',
    lenderName: 'ICICI Bank',
    loanAmount: 600000,
    interestRate: 9.0,
    tenureMonths: 60,
    commissionAmount: 12000,
    status: LoanStatus.ENQUIRY,
    branchId: 'branch-tnk',
    submittingUserId: 'user-dharshan',
    createdAt: new Date(),
    updatedAt: new Date(),
    branch: mockTnkBranch,
    submittingUser: {
      id: 'user-dharshan',
      firstName: 'Dharshan',
      lastName: 'User',
      email: 'dharshan@nexus.local',
    },
  };

  function createService(overrides: Partial<any> = {}) {
    const prisma = {
      loanApplication: {
        count: async () => 1,
        findMany: async (args: any) => {
          if (args?.where?.branchId === 'branch-tnk') return [tnkLoan];
          return [kkdLoan];
        },
        findUnique: async (args: any) => {
          if (args.where.id === 'loan-tnk-1') return tnkLoan;
          if (args.where.id === 'loan-kkd-1') return kkdLoan;
          return null;
        },
        create: async (args: any) => ({
          ...args.data,
          id: 'loan-created',
          branch: mockBranch,
          submittingUser: { id: args.data.submittingUserId },
        }),
      },
      branch: {
        findUnique: async (args: any) => {
          if (args.where.id === 'branch-kkd') return mockBranch;
          if (args.where.id === 'branch-tnk') return mockTnkBranch;
          return null;
        },
      },
      ...overrides,
    };

    return new FinanceLoanService(prisma as any);
  }

  describe('1. Listing Loans (findAll)', () => {
    it('non-admin user requesting another branch gets 403 Forbidden', async () => {
      const service = createService();
      await assert.rejects(
        async () => {
          await service.findAll(kkdBranchUser, { branchId: 'branch-tnk' });
        },
        (err: any) => {
          assert.equal(err instanceof ForbiddenException, true);
          assert.match(err.message, /Access denied: You do not have permission to access branch 'branch-tnk'/);
          return true;
        },
      );
    });

    it('non-admin user requesting their own branch succeeds', async () => {
      const service = createService();
      const res = await service.findAll(kkdBranchUser, { branchId: 'branch-kkd' });
      assert.equal(res.data.length, 1);
      assert.equal(res.data[0].branchId, 'branch-kkd');
    });

    it('non-admin user with no branch param automatically scopes to user branchIds', async () => {
      let scopedWhere: any;
      const service = createService({
        loanApplication: {
          count: async () => 1,
          findMany: async (args: any) => {
            scopedWhere = args.where;
            return [kkdLoan];
          },
        },
      });

      await service.findAll(kkdBranchUser, {});
      assert.deepEqual(scopedWhere.branchId, { in: ['branch-kkd'] });
    });

    it('SYSTEM_ADMIN can query any branch without 403', async () => {
      const service = createService();
      const res = await service.findAll(adminUser, { branchId: 'branch-tnk' });
      assert.equal(res.data.length, 1);
      assert.equal(res.data[0].branchId, 'branch-tnk');
    });
  });

  describe('2. Fetching Single Loan (findOne)', () => {
    it('non-admin user trying to access loan from another branch gets 403 Forbidden', async () => {
      const service = createService();
      await assert.rejects(
        async () => {
          await service.findOne(kkdBranchUser, 'loan-tnk-1');
        },
        (err: any) => {
          assert.equal(err instanceof ForbiddenException, true);
          assert.match(err.message, /Access denied/);
          return true;
        },
      );
    });

    it('non-admin user can access loan from their own branch', async () => {
      const service = createService();
      const loan = await service.findOne(kkdBranchUser, 'loan-kkd-1');
      assert.equal(loan.id, 'loan-kkd-1');
      assert.equal(loan.branchId, 'branch-kkd');
    });

    it('SYSTEM_ADMIN can access loan from any branch', async () => {
      const service = createService();
      const loan = await service.findOne(adminUser, 'loan-tnk-1');
      assert.equal(loan.id, 'loan-tnk-1');
      assert.equal(loan.branchId, 'branch-tnk');
    });
  });

  describe('3. Creating Loan (create)', () => {
    it('non-admin user trying to create loan for another branch gets 403 Forbidden', async () => {
      const service = createService();
      await assert.rejects(
        async () => {
          await service.create(kkdBranchUser, {
            customerName: 'New Customer',
            lenderName: 'HDFC Bank',
            loanAmount: 400000,
            interestRate: 10,
            tenureMonths: 36,
            branchId: 'branch-tnk',
          });
        },
        (err: any) => {
          assert.equal(err instanceof ForbiddenException, true);
          assert.match(err.message, /Access denied/);
          return true;
        },
      );
    });

    it('non-admin user can create loan for their own branch', async () => {
      const service = createService();
      const created = await service.create(kkdBranchUser, {
        customerName: 'New Customer',
        lenderName: 'HDFC Bank',
        loanAmount: 400000,
        interestRate: 10,
        tenureMonths: 36,
        branchId: 'branch-kkd',
      });
      assert.equal(created.branchId, 'branch-kkd');
    });

    it('SYSTEM_ADMIN can create loan for any valid branch', async () => {
      const service = createService();
      const created = await service.create(adminUser, {
        customerName: 'Admin Customer',
        lenderName: 'SBI',
        loanAmount: 700000,
        interestRate: 8.5,
        tenureMonths: 48,
        branchId: 'branch-tnk',
      });
      assert.equal(created.branchId, 'branch-tnk');
    });
  });

  describe('4. Status Update (updateStatus)', () => {
    it('non-admin user cannot change status of loan from another branch (403 Forbidden)', async () => {
      const service = createService();
      await assert.rejects(
        async () => {
          await service.updateStatus(kkdBranchUser, 'loan-tnk-1', {
            status: LoanStatus.SUBMITTED,
          });
        },
        (err: any) => {
          assert.equal(err instanceof ForbiddenException, true);
          assert.match(err.message, /Access denied/);
          return true;
        },
      );
    });
  });

  describe('5. Metrics (getMetrics)', () => {
    it('non-admin user requesting metrics for another branch gets 403 Forbidden', async () => {
      const service = createService();
      await assert.rejects(
        async () => {
          await service.getMetrics(kkdBranchUser, 'branch-tnk');
        },
        (err: any) => {
          assert.equal(err instanceof ForbiddenException, true);
          assert.match(err.message, /Access denied/);
          return true;
        },
      );
    });

    it('SYSTEM_ADMIN can request metrics for any branch or all branches', async () => {
      const service = createService();
      const metrics = await service.getMetrics(adminUser, 'branch-tnk');
      assert.notEqual(metrics, null);
    });
  });
});
