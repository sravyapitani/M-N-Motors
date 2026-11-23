import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { FinanceLoanController } from './finance-loan.controller';
import { LoanStatus } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

describe('FinanceLoanController', () => {
  const mockUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'user@nexus.local',
    department: 'FINANCE',
    roles: ['LOAN_OFFICER'],
    permissions: [],
    branchIds: ['branch-mumbai'],
  };

  it('should delegate findAll to the service', async () => {
    let calledWithUser: any = null;
    let calledWithQuery: any = null;

    const mockService: any = {
      findAll: async (user: any, query: any) => {
        calledWithUser = user;
        calledWithQuery = query;
        return { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
      },
    };

    const controller = new FinanceLoanController(mockService);
    const result = await controller.findAll({ user: mockUser }, { page: 2, limit: 10 });

    assert.strictEqual(calledWithUser.userId, 'user-1');
    assert.strictEqual(calledWithQuery.page, 2);
    assert.strictEqual(result.total, 0);
  });

  it('should delegate create to the service', async () => {
    const mockService: any = {
      create: async (user: any, dto: any) => {
        return { id: 'created-loan-id', ...dto, status: LoanStatus.ENQUIRY };
      },
    };

    const controller = new FinanceLoanController(mockService);
    const result = await controller.create(
      { user: mockUser },
      {
        customerName: 'Ayesha Rao',
        lenderName: 'Vertex Capital',
        loanAmount: 500000,
        interestRate: 10,
        tenureMonths: 36,
        branchId: 'branch-mumbai',
      },
    );

    assert.strictEqual(result.id, 'created-loan-id');
    assert.strictEqual(result.customerName, 'Ayesha Rao');
  });

  it('should delegate findOne to the service', async () => {
    const mockService: any = {
      findOne: async (user: any, id: string) => ({ id, customerName: 'Ayesha Rao' }),
    };

    const controller = new FinanceLoanController(mockService);
    const result = await controller.findOne({ user: mockUser }, 'loan-123');

    assert.strictEqual(result.id, 'loan-123');
  });

  it('should delegate updateStatus to the service', async () => {
    const mockService: any = {
      updateStatus: async (user: any, id: string, dto: any) => ({
        id,
        status: dto.status,
      }),
    };

    const controller = new FinanceLoanController(mockService);
    const result = await controller.updateStatus(
      { user: mockUser },
      'loan-123',
      { status: LoanStatus.SUBMITTED },
    );

    assert.strictEqual(result.status, LoanStatus.SUBMITTED);
  });

  it('should delegate getMetrics to the service', async () => {
    const mockService: any = {
      getMetrics: async (user: any, branchId?: string) => ({
        totalApplications: 10,
        activeLoans: 6,
        branchId,
      }),
    };

    const controller = new FinanceLoanController(mockService);
    const result = await controller.getMetrics({ user: mockUser }, 'branch-mumbai');

    assert.strictEqual(result.totalApplications, 10);
    assert.strictEqual(result.activeLoans, 6);
  });
});
