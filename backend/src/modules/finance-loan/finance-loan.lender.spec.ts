import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { FinanceLoanService } from './finance-loan.service';
import { FinanceLenderController } from './finance-lender.controller';
import { LenderType, LoanStatus } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

describe('FinanceLoanService & FinanceLenderController - Lender Master', () => {
  const mockUser: AuthenticatedUser = {
    userId: 'user-staff-1',
    email: 'staff@nexus.local',
    department: 'FINANCE',
    roles: [],
    permissions: [],
    branchIds: ['branch-1'],
  };

  const sampleActiveLender = {
    id: 'lender-hdfc-1',
    name: 'HDFC Bank',
    tallyLedgerName: 'HDFC Bank Finance Payouts',
    type: LenderType.BANK,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleInactiveLender = {
    id: 'lender-boi-shareholding',
    name: 'BOI Shareholding',
    tallyLedgerName: 'BOI Shareholding Ltd(Payouts)',
    type: LenderType.OTHER,
    isActive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleBranch = {
    id: 'branch-1',
    code: 'KKD',
    name: 'Kakinada',
    isActive: true,
  };

  function createService(overrides: Partial<any> = {}) {
    const prisma = {
      lender: {
        findMany: async (args?: any) => {
          if (args?.where?.isActive === true) return [sampleActiveLender];
          if (args?.where?.isActive === false) return [sampleInactiveLender];
          return [sampleActiveLender, sampleInactiveLender];
        },
        findUnique: async (args: any) => {
          if (args.where.id === sampleActiveLender.id) return sampleActiveLender;
          if (args.where.id === sampleInactiveLender.id) return sampleInactiveLender;
          return null;
        },
        findFirst: async (args: any) => {
          if (args?.where?.OR) {
            const matchesActive = args.where.OR.some(
              (clause: any) =>
                clause.name?.equals?.toLowerCase() === sampleActiveLender.name.toLowerCase() ||
                clause.tallyLedgerName?.equals?.toLowerCase() === sampleActiveLender.tallyLedgerName.toLowerCase()
            );
            if (matchesActive && args.where.isActive !== false) return sampleActiveLender;
          }
          return null;
        },
      },
      branch: {
        findUnique: async (args: any) => {
          if (args.where.id === sampleBranch.id) return sampleBranch;
          return null;
        },
      },
      loanApplication: {
        create: async (args: any) => ({
          id: 'loan-created-1',
          ...args.data,
          branch: sampleBranch,
          submittingUser: { id: args.data.submittingUserId },
          lender: args.data.lenderId ? sampleActiveLender : null,
        }),
        findMany: async () => [],
      },
      ...overrides,
    };

    return new FinanceLoanService(prisma as any);
  }

  describe('1. Controller delegation (GET /api/finance/lenders)', () => {
    it('should delegate findAll to loanService.findAllLenders with query', async () => {
      let queryPassed: any = null;
      const mockService: any = {
        findAllLenders: async (q: any) => {
          queryPassed = q;
          return [sampleActiveLender];
        },
      };

      const controller = new FinanceLenderController(mockService);
      const result = await controller.findAll({ isActive: true, type: LenderType.BANK });

      assert.strictEqual(queryPassed.isActive, true);
      assert.strictEqual(queryPassed.type, LenderType.BANK);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].id, sampleActiveLender.id);
    });
  });

  describe('2. Listing Lenders (findAllLenders)', () => {
    it('should query lenders with isActive filter', async () => {
      let capturedWhere: any = null;
      const service = createService({
        lender: {
          findMany: async (args: any) => {
            capturedWhere = args.where;
            return [sampleActiveLender];
          },
        },
      });

      const result = await service.findAllLenders({ isActive: true });
      assert.strictEqual(capturedWhere.isActive, true);
      assert.strictEqual(result.length, 1);
    });

    it('should query lenders with search and type filter', async () => {
      let capturedWhere: any = null;
      const service = createService({
        lender: {
          findMany: async (args: any) => {
            capturedWhere = args.where;
            return [sampleActiveLender];
          },
        },
      });

      await service.findAllLenders({ search: 'HDFC', type: LenderType.BANK });
      assert.strictEqual(capturedWhere.type, LenderType.BANK);
      assert.ok(Array.isArray(capturedWhere.OR));
    });
  });

  describe('3. Creating Loan with Lender Integration (create)', () => {
    it('should create loan when valid active lenderId is provided', async () => {
      const service = createService();
      const created = await service.create(mockUser, {
        customerName: 'Ravi Teja',
        lenderId: sampleActiveLender.id,
        loanAmount: 800000,
        interestRate: 9.25,
        tenureMonths: 60,
        branchId: sampleBranch.id,
      });

      assert.strictEqual(created.lenderId, sampleActiveLender.id);
      assert.strictEqual(created.lenderName, sampleActiveLender.name);
      assert.strictEqual(created.customerName, 'Ravi Teja');
    });

    it('should reject loan creation when lenderId does not exist', async () => {
      const service = createService();
      await assert.rejects(
        async () => {
          await service.create(mockUser, {
            customerName: 'Ravi Teja',
            lenderId: 'non-existent-lender',
            loanAmount: 800000,
            interestRate: 9.25,
            tenureMonths: 60,
            branchId: sampleBranch.id,
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.match(err.message, /is invalid or inactive/);
          return true;
        },
      );
    });

    it('should reject loan creation when lenderId is inactive', async () => {
      const service = createService();
      await assert.rejects(
        async () => {
          await service.create(mockUser, {
            customerName: 'Ravi Teja',
            lenderId: sampleInactiveLender.id,
            loanAmount: 800000,
            interestRate: 9.25,
            tenureMonths: 60,
            branchId: sampleBranch.id,
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.match(err.message, /is invalid or inactive/);
          return true;
        },
      );
    });

    it('should support backward compatibility: auto-link lenderId when matched by lenderName', async () => {
      const service = createService();
      const created = await service.create(mockUser, {
        customerName: 'Suresh Kumar',
        lenderName: 'HDFC Bank',
        loanAmount: 500000,
        interestRate: 8.5,
        tenureMonths: 36,
        branchId: sampleBranch.id,
      });

      assert.strictEqual(created.lenderId, sampleActiveLender.id);
      assert.strictEqual(created.lenderName, sampleActiveLender.name);
    });

    it('should support backward compatibility: allow unknown lenderName with lenderId=null', async () => {
      const service = createService();
      const created = await service.create(mockUser, {
        customerName: 'Suresh Kumar',
        lenderName: 'Cooperative Rural Bank',
        loanAmount: 500000,
        interestRate: 8.5,
        tenureMonths: 36,
        branchId: sampleBranch.id,
      });

      assert.strictEqual(created.lenderId, null);
      assert.strictEqual(created.lenderName, 'Cooperative Rural Bank');
    });

    it('should reject loan creation when neither lenderId nor lenderName is provided', async () => {
      const service = createService();
      await assert.rejects(
        async () => {
          await service.create(mockUser, {
            customerName: 'Suresh Kumar',
            loanAmount: 500000,
            interestRate: 8.5,
            tenureMonths: 36,
            branchId: sampleBranch.id,
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.match(err.message, /Either a valid lender ID or lender name is required/);
          return true;
        },
      );
    });
  });

  describe('4. Metrics byLender Grouping (getMetrics)', () => {
    it('should group by lenderId when present and fall back to lenderName', async () => {
      const loans = [
        {
          status: LoanStatus.DISBURSED,
          loanAmount: 500000,
          commissionAmount: 10000,
          lenderName: 'HDFC Bank',
          lenderId: 'lender-hdfc-1',
          lender: { id: 'lender-hdfc-1', name: 'HDFC Bank' },
        },
        {
          status: LoanStatus.SUBMITTED,
          loanAmount: 300000,
          commissionAmount: 6000,
          lenderName: 'HDFC Bank',
          lenderId: 'lender-hdfc-1',
          lender: { id: 'lender-hdfc-1', name: 'HDFC Bank' },
        },
        {
          status: LoanStatus.DISBURSED,
          loanAmount: 400000,
          commissionAmount: 8000,
          lenderName: 'Legacy Bank XYZ',
          lenderId: null,
          lender: null,
        },
      ];

      const service = createService({
        loanApplication: {
          findMany: async () => loans,
        },
      });

      const metrics = await service.getMetrics(mockUser, sampleBranch.id);
      assert.strictEqual(metrics.byLender.length, 2);

      const hdfc = metrics.byLender.find((l) => l.name === 'HDFC Bank');
      assert.ok(hdfc);
      assert.strictEqual(hdfc.count, 2);
      assert.strictEqual(hdfc.totalAmount, 800000);
      assert.strictEqual(hdfc.commission, 16000);

      const legacy = metrics.byLender.find((l) => l.name === 'Legacy Bank XYZ');
      assert.ok(legacy);
      assert.strictEqual(legacy.count, 1);
      assert.strictEqual(legacy.totalAmount, 400000);
      assert.strictEqual(legacy.commission, 8000);
    });
  });
});

