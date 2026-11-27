import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import './funding-calculator.spec';
import {
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { FinanceFundingService, AuthenticatedUser } from './finance-funding.service';

describe('FinanceFundingService', () => {
    const adminUser: AuthenticatedUser = {
        userId: 'admin-1',
        email: 'admin@nexuserp.demo',
        roles: ['SYSTEM_ADMIN'],
        permissions: [],
    };

    const financeManager: AuthenticatedUser = {
        userId: 'fm-1',
        email: 'fm@nexuserp.demo',
        roles: ['FINANCE_MANAGER'],
        permissions: ['CC_VIEW', 'CC_MANAGE'],
    };

    const financeExecutive: AuthenticatedUser = {
        userId: 'fe-1',
        email: 'fe@nexuserp.demo',
        roles: ['FINANCE_EXECUTIVE'],
        permissions: ['CC_VIEW'],
    };

    const branchHead: AuthenticatedUser = {
        userId: 'bh-1',
        email: 'bh@nexuserp.demo',
        roles: ['BRANCH_HEAD'],
        permissions: [],
    };

    describe('1. Permission Enforcement', () => {
        const service = new FinanceFundingService({} as any);

        it('should allow SYSTEM_ADMIN to bypass CC_VIEW and CC_MANAGE', () => {
            assert.doesNotThrow(() => service.verifyCcViewAccess(adminUser));
            assert.doesNotThrow(() => service.verifyCcManageAccess(adminUser));
        });

        it('should allow FINANCE_MANAGER with CC_VIEW and CC_MANAGE', () => {
            assert.doesNotThrow(() => service.verifyCcViewAccess(financeManager));
            assert.doesNotThrow(() => service.verifyCcManageAccess(financeManager));
        });

        it('should allow FINANCE_EXECUTIVE with CC_VIEW, but deny CC_MANAGE', () => {
            assert.doesNotThrow(() => service.verifyCcViewAccess(financeExecutive));
            assert.throws(
                () => service.verifyCcManageAccess(financeExecutive),
                ForbiddenException,
            );
        });

        it('should deny BRANCH_HEAD without permissions from both CC_VIEW and CC_MANAGE', () => {
            assert.throws(() => service.verifyCcViewAccess(branchHead), ForbiddenException);
            assert.throws(() => service.verifyCcManageAccess(branchHead), ForbiddenException);
        });
    });

    describe('2. Draw Creation & Over-Limit Warning', () => {
        it('should reject draw amount <= 0 with BadRequestException', async () => {
            const mockPrisma = {
                fundingFacility: {
                    findUnique: async () => ({ id: 'fac-1', isActive: true, sanctionedLimit: 1000000, draws: [] }),
                },
            };
            const service = new FinanceFundingService(mockPrisma as any);

            await assert.rejects(
                async () => service.createDraw(adminUser, { facilityId: 'fac-1', drawDate: '2026-11-01', amount: 0 }),
                (err: any) => err instanceof BadRequestException && err.message.includes('greater than 0'),
            );
        });

        it('should return warning when draw takes facility over sanctioned limit', async () => {
            const mockFacility = {
                id: 'fac-1',
                bankName: 'HDFC Bank',
                productCode: 'INF-AD',
                isActive: true,
                sanctionedLimit: 10000000, // 1 Cr limit
                draws: [
                    { amount: 8000000, repayments: [{ amount: 1000000 }] }, // 70L used
                ],
            };

            let createdRecord: any = null;
            const mockPrisma = {
                fundingFacility: {
                    findUnique: async () => mockFacility,
                },
                fundingDraw: {
                    create: async ({ data }: any) => {
                        createdRecord = data;
                        return { id: 'draw-new', ...data };
                    },
                },
            };

            const service = new FinanceFundingService(mockPrisma as any);

            // Adding a 40L draw: 70L + 40L = 110L (exceeds 100L limit by 10L)
            const result = await service.createDraw(financeManager, {
                facilityId: 'fac-1',
                drawDate: '2026-11-01',
                amount: 4000000,
                reference: 'UTR-123456',
            });

            assert.ok(result.draw);
            assert.ok(result.warning);
            assert.match(result.warning, /takes facility over sanctioned limit by ₹10,00,000/);
            assert.equal(createdRecord.amount, 4000000);
        });
    });

    describe('3. Repayment Validation (User Rule 7)', () => {
        it('should reject repayment greater than outstanding with clear 400 message', async () => {
            const mockDraw = {
                id: 'draw-1',
                amount: 5000000, // 50L draw
                repayments: [
                    { amount: 2000000 }, // 20L repaid -> 30L outstanding
                ],
            };

            const mockPrisma = {
                fundingDraw: {
                    findUnique: async () => mockDraw,
                },
            };

            const service = new FinanceFundingService(mockPrisma as any);

            // Attempting to repay 35L when only 30L is outstanding
            await assert.rejects(
                async () => service.recordRepayment(financeManager, 'draw-1', {
                    amount: 3500000,
                    paymentDate: '2026-11-20',
                }),
                (err: any) => {
                    assert.ok(err instanceof BadRequestException);
                    // Match: Repayment ₹35,00,000 is more than outstanding ₹30,00,000.
                    assert.match(err.message, /Repayment ₹35,00,000 is more than outstanding ₹30,00,000/);
                    return true;
                },
            );
        });

        it('should accept repayment equal to or less than outstanding', async () => {
            const mockDraw = {
                id: 'draw-1',
                amount: 5000000,
                repayments: [{ amount: 2000000 }], // 30L outstanding
            };

            let savedRepayment: any = null;
            const mockPrisma = {
                fundingDraw: {
                    findUnique: async () => mockDraw,
                },
                fundingRepayment: {
                    create: async ({ data }: any) => {
                        savedRepayment = data;
                        return { id: 'rep-1', ...data };
                    },
                },
            };

            const service = new FinanceFundingService(mockPrisma as any);
            const res = await service.recordRepayment(financeManager, 'draw-1', {
                amount: 3000000,
                paymentDate: '2026-11-20',
                reference: 'UTR-FINAL',
            });

            assert.equal(res.amount, 3000000);
            assert.equal(savedRepayment.amount, 3000000);
        });
    });

    describe('4. Audit Trail on Draw Updates', () => {
        it('should record history entries for each modified field', async () => {
            const existingDraw = {
                id: 'draw-1',
                amount: 5000000,
                drawDate: new Date('2026-10-01'),
                reference: 'OLD-REF',
                notes: 'Old notes',
                branchId: 'b-1',
            };

            const historyCreated: any[] = [];
            let updatedData: any = null;

            const mockPrisma = {
                fundingDraw: {
                    findUnique: async () => existingDraw,
                },
                $transaction: async (fn: any) => {
                    return fn({
                        fundingDraw: {
                            update: async ({ data }: any) => {
                                updatedData = data;
                            },
                        },
                        fundingDrawHistory: {
                            create: async ({ data }: any) => {
                                historyCreated.push(data);
                            },
                        },
                    });
                },
            };

            const service = new FinanceFundingService(mockPrisma as any);
            // Mock getDrawById
            (service as any).getDrawById = async () => ({ id: 'draw-1', ...updatedData });

            await service.updateDraw(adminUser, 'draw-1', {
                amount: 6000000,
                reference: 'NEW-REF',
            });

            assert.equal(historyCreated.length, 2);
            assert.deepEqual(historyCreated.map((h) => h.field).sort(), ['amount', 'reference']);
            const amountEntry = historyCreated.find((h) => h.field === 'amount');
            assert.equal(amountEntry.oldValue, '5000000');
            assert.equal(amountEntry.newValue, '6000000');
        });

        it('editing drawDate creates 1 history row', async () => {
            const existingDraw = {
                id: 'draw-date-test',
                amount: 10000000,
                drawDate: new Date('2026-11-27'),
                reference: 'REF-1',
                notes: 'Notes',
                branchId: null,
            };

            const historyCreated: any[] = [];
            let updatedData: any = null;

            const mockPrisma = {
                fundingDraw: {
                    findUnique: async () => existingDraw,
                },
                $transaction: async (fn: any) => {
                    return fn({
                        fundingDraw: {
                            update: async ({ data }: any) => {
                                updatedData = data;
                            },
                        },
                        fundingDrawHistory: {
                            create: async ({ data }: any) => {
                                historyCreated.push(data);
                            },
                        },
                    });
                },
            };

            const service = new FinanceFundingService(mockPrisma as any);
            (service as any).getDrawById = async () => ({ id: 'draw-date-test', ...updatedData });

            await service.updateDraw(adminUser, 'draw-date-test', {
                drawDate: '2026-10-06',
            });

            assert.equal(historyCreated.length, 1);
            const entry = historyCreated[0];
            assert.equal(entry.field, 'drawDate');
            assert.equal(entry.oldValue, '2026-11-27');
            assert.equal(entry.newValue, '2026-10-06');
            assert.equal(entry.userId, adminUser.userId);
        });
    });

    describe('5. Facilities Listing & Grace Period Mapping', () => {
        it('should map null graceDays to 60 default and 52 to 52', async () => {
            const mockFacilities = [
                {
                    id: 'fac-1',
                    facilityKey: 'FAC-NULL',
                    bankName: 'Sample Bank A',
                    productCode: 'CC',
                    facilityType: 'CC',
                    sanctionedLimit: '20000000.00',
                    roiPercent: '9.00',
                    graceDays: null,
                    isActive: true,
                    lenderId: null,
                    lender: null,
                    draws: [],
                    createdAt: new Date(),
                },
                {
                    id: 'fac-2',
                    facilityKey: 'FAC-52',
                    bankName: 'Sample Bank B',
                    productCode: 'INF-AD',
                    facilityType: 'INVENTORY',
                    sanctionedLimit: '30000000.00',
                    roiPercent: null,
                    graceDays: 52,
                    isActive: true,
                    lenderId: null,
                    lender: null,
                    draws: [],
                    createdAt: new Date(),
                },
            ];

            const mockPrisma = {
                fundingFacility: {
                    findMany: async () => mockFacilities,
                },
            };

            const service = new FinanceFundingService(mockPrisma as any);
            const facilities = await service.getFacilities();

            assert.equal(facilities.length, 2);

            const facNull = facilities.find((f) => f.facilityKey === 'FAC-NULL')!;
            assert.equal(facNull.graceDays, null);
            assert.equal(facNull.effectiveGraceDays, 60);
            assert.equal(facNull.isDefaultGrace, true);

            const fac52 = facilities.find((f) => f.facilityKey === 'FAC-52')!;
            assert.equal(fac52.graceDays, 52);
            assert.equal(fac52.effectiveGraceDays, 52);
            assert.equal(fac52.isDefaultGrace, false);
        });
    });

    describe('6. Summary Calculation with 12 Decimal Facilities Totalling 59 Cr', () => {
        it('should correctly sum 12 facilities totaling 59 Cr with accurate used and available amounts', async () => {
            // Simulated Prisma Decimal object
            class MockPrismaDecimal {
                constructor(private val: string) {}
                toString() { return this.val; }
                valueOf() { return Number(this.val); }
                [Symbol.toPrimitive]() { return Number(this.val); }
            }

            // 11 facilities of 5 Cr + 1 facility of 4 Cr = 59 Cr total (590,000,000)
            const limits = [
                '50000000.00', '50000000.00', '50000000.00', '50000000.00',
                '50000000.00', '50000000.00', '50000000.00', '50000000.00',
                '50000000.00', '50000000.00', '50000000.00', '40000000.00',
            ];

            const mockFacilities = limits.map((lim, idx) => {
                const draws = [];
                // Facility 0 has a 1 Cr draw with 20L repaid -> 80L used
                if (idx === 0) {
                    draws.push({
                        amount: new MockPrismaDecimal('10000000.00'),
                        repayments: [{ amount: new MockPrismaDecimal('2000000.00') }],
                    });
                }
                // Facility 1 has a 2 Cr draw with 0 repaid -> 2 Cr used
                if (idx === 1) {
                    draws.push({
                        amount: new MockPrismaDecimal('20000000.00'),
                        repayments: [],
                    });
                }

                return {
                    id: `fac-${idx + 1}`,
                    facilityKey: `FAC-KEY-${idx + 1}`,
                    bankName: `Bank ${String.fromCharCode(65 + (idx % 4))}`,
                    productCode: 'CC',
                    facilityType: 'CC',
                    sanctionedLimit: new MockPrismaDecimal(lim),
                    roiPercent: new MockPrismaDecimal('9.50'),
                    graceDays: idx % 2 === 0 ? null : 45,
                    isActive: true,
                    lenderId: null,
                    lender: null,
                    draws,
                    createdAt: new Date(),
                };
            });

            const mockPrisma = {
                fundingFacility: {
                    findMany: async () => mockFacilities,
                },
                fundingDraw: {
                    findMany: async () => [],
                },
            };

            const service = new FinanceFundingService(mockPrisma as any);
            const summary = await service.getSummary();

            // Total limit: 59 Cr = 590,000,000
            assert.equal(summary.totalLimit, 590000000);
            assert.equal(typeof summary.totalLimit, 'number');

            // Total used: 80L + 2 Cr = 2.8 Cr = 28,000,000
            assert.equal(summary.totalUsed, 28000000);
            assert.equal(typeof summary.totalUsed, 'number');

            // Total available: 59 Cr - 2.8 Cr = 56.2 Cr = 562,000,000
            assert.equal(summary.totalAvailable, 562000000);
            assert.equal(typeof summary.totalAvailable, 'number');

            // Facilities count: 12
            assert.equal(summary.facilitiesCount, 12);

            // Active draws: 2
            assert.equal(summary.activeDrawsCount, 2);

            // Overall utilisation: 28,000,000 / 590,000,000 = 4.75% -> 5%
            assert.equal(summary.overallUtilisationPercent, 5);
        });
    });

    describe('7. Query Filtering & Draws Pagination (getDraws)', () => {
        const rawDraws = [
            {
                id: 'draw-1',
                facilityId: 'fac-1',
                drawDate: new Date('2026-11-01'),
                amount: 10000000,
                reference: 'REF-1',
                notes: 'Note 1',
                branchId: null,
                facility: {
                    id: 'fac-1',
                    facilityKey: 'KEY-1',
                    bankName: 'Bank A',
                    productCode: 'CC',
                    sanctionedLimit: 20000000,
                    roiPercent: 9.0,
                    graceDays: 60,
                },
                branch: null,
                createdBy: null,
                repayments: [],
                createdAt: new Date(),
            },
            {
                id: 'draw-2',
                facilityId: 'fac-2',
                drawDate: new Date('2026-10-15'),
                amount: 20000000,
                reference: 'REF-2',
                notes: 'Note 2',
                branchId: null,
                facility: {
                    id: 'fac-2',
                    facilityKey: 'KEY-2',
                    bankName: 'Bank B',
                    productCode: 'INF-AD',
                    sanctionedLimit: 30000000,
                    roiPercent: 9.5,
                    graceDays: 45,
                },
                branch: null,
                createdBy: null,
                repayments: [{ amount: 5000000, paymentDate: new Date('2026-10-25'), reference: 'R-1' }],
                createdAt: new Date(),
            },
        ];

        it('should return all draws when no filters are provided, returning data array and total', async () => {
            let capturedWhere: any = null;
            const mockPrisma = {
                fundingDraw: {
                    findMany: async ({ where }: any) => {
                        capturedWhere = where;
                        return rawDraws;
                    },
                },
            };

            const service = new FinanceFundingService(mockPrisma as any);
            const res = await service.getDraws({});

            assert.equal(capturedWhere.facilityId, undefined);
            assert.ok(Array.isArray(res.data));
            assert.equal(res.data.length, 2);
            assert.equal(res.total, 2);
            assert.equal(res.page, 1);
            assert.equal(res.limit, 25);
            assert.equal(res.data[0].id, 'draw-1');
            assert.equal(res.data[0].sanctionedLimit, 20000000);
            assert.equal(res.data[0].repaymentsCount, 0);
            assert.equal(res.data[1].repaymentsCount, 1);
        });

        it('should treat status "ALL", "all", "", and whitespace as no filter', async () => {
            const mockPrisma = {
                fundingDraw: {
                    findMany: async () => rawDraws,
                },
            };

            const service = new FinanceFundingService(mockPrisma as any);

            const res1 = await service.getDraws({ status: 'ALL' });
            assert.equal(res1.data.length, 2);

            const res2 = await service.getDraws({ status: 'all' });
            assert.equal(res2.data.length, 2);

            const res3 = await service.getDraws({ status: '' });
            assert.equal(res3.data.length, 2);

            const res4 = await service.getDraws({ status: '   ' });
            assert.equal(res4.data.length, 2);
        });

        it('should treat facilityId "ALL", "all", "", and whitespace as no filter', async () => {
            let capturedWhere: any = null;
            const mockPrisma = {
                fundingDraw: {
                    findMany: async ({ where }: any) => {
                        capturedWhere = where;
                        return rawDraws;
                    },
                },
            };

            const service = new FinanceFundingService(mockPrisma as any);

            await service.getDraws({ facilityId: 'ALL' });
            assert.equal(capturedWhere.facilityId, undefined);

            await service.getDraws({ facilityId: 'all' });
            assert.equal(capturedWhere.facilityId, undefined);

            await service.getDraws({ facilityId: '' });
            assert.equal(capturedWhere.facilityId, undefined);

            await service.getDraws({ facilityId: '   ' });
            assert.equal(capturedWhere.facilityId, undefined);
        });

        it('should filter by specific facilityId when provided', async () => {
            let capturedWhere: any = null;
            const mockPrisma = {
                fundingDraw: {
                    findMany: async ({ where }: any) => {
                        capturedWhere = where;
                        return rawDraws.filter((d) => d.facilityId === where.facilityId);
                    },
                },
            };

            const service = new FinanceFundingService(mockPrisma as any);
            const res = await service.getDraws({ facilityId: 'fac-1' });

            assert.equal(capturedWhere.facilityId, 'fac-1');
            assert.equal(res.data.length, 1);
            assert.equal(res.data[0].facilityId, 'fac-1');
            assert.equal(res.total, 1);
        });

        it('should support limit up to 200', async () => {
            const mockPrisma = {
                fundingDraw: {
                    findMany: async () => rawDraws,
                },
            };

            const service = new FinanceFundingService(mockPrisma as any);
            const res = await service.getDraws({ limit: '200' });
            assert.equal(res.limit, 200);
        });
    });
});
