import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
    LOAN_AMOUNT_PAYOUT_DAYS,
    COMMISSION_PAYOUT_DAYS,
    DEFAULT_PAYOUT_DAYS,
    toCents,
    fromCents,
    computeExpectedDate,
    computePayoutStatus,
} from './payout-calculator';

describe('Payout Calculator & Financial Rules', () => {
    it('LOAN_AMOUNT_PAYOUT_DAYS named constant should be 2', () => {
        // PROVISIONAL: confirm with Sir
        assert.strictEqual(LOAN_AMOUNT_PAYOUT_DAYS, 2);
    });

    it('COMMISSION_PAYOUT_DAYS named constant should be 60', () => {
        // PROVISIONAL: confirm with Sir
        assert.strictEqual(COMMISSION_PAYOUT_DAYS, 60);
        assert.strictEqual(DEFAULT_PAYOUT_DAYS, 60);
    });

    it('toCents and fromCents eliminates floating-point drift', () => {
        assert.strictEqual(toCents(0.1 + 0.2), 30);
        assert.strictEqual(toCents('1500.50'), 150050);
        assert.strictEqual(fromCents(150050), 1500.50);
        assert.strictEqual(fromCents(toCents(100.05)), 100.05);
    });

    it('computeExpectedDate computes 2 days for LOAN_AMOUNT and supports lender payoutDays override', () => {
        const start = new Date('2026-01-01T00:00:00Z');
        // Default 2 days for LOAN_AMOUNT
        const withDefault = computeExpectedDate(start, 'LOAN_AMOUNT');
        assert.strictEqual(
            withDefault.toISOString().split('T')[0],
            new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        );

        // Lender override payoutDays
        const withLenderOverride = computeExpectedDate(start, 'LOAN_AMOUNT', { payoutDays: 5 });
        assert.strictEqual(
            withLenderOverride.toISOString().split('T')[0],
            new Date(start.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        );
    });

    it('computeExpectedDate computes 60 days for COMMISSION and supports lender commissionPayoutDays override', () => {
        const start = new Date('2026-01-01T00:00:00Z');
        // Default 60 days for COMMISSION
        const withDefault = computeExpectedDate(start, 'COMMISSION');
        assert.strictEqual(
            withDefault.toISOString().split('T')[0],
            new Date(start.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        );

        // Lender override commissionPayoutDays
        const withLenderOverride = computeExpectedDate(start, 'COMMISSION', { commissionPayoutDays: 45 });
        assert.strictEqual(
            withLenderOverride.toISOString().split('T')[0],
            new Date(start.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        );
    });

    it('computes RECEIVED when received >= expected', () => {
        const result = computePayoutStatus({
            expectedAmount: 10000,
            receivedAmount: 10000,
            expectedDate: '2026-01-10',
            dateEstimated: false,
            today: '2026-01-15',
        });
        assert.strictEqual(result.status, 'RECEIVED');
        assert.strictEqual(result.outstandingAmount, 0);
        assert.strictEqual(result.isOverdue, false);
    });

    it('computes PARTIAL when 0 < received < expected', () => {
        const result = computePayoutStatus({
            expectedAmount: 10000,
            receivedAmount: 4000,
            expectedDate: '2026-02-10',
            dateEstimated: false,
            today: '2026-01-15',
        });
        assert.strictEqual(result.status, 'PARTIAL');
        assert.strictEqual(result.outstandingAmount, 6000);
        assert.strictEqual(result.isOverdue, false);
    });

    it('computes PENDING when received = 0 and expectedDate is in the future', () => {
        const result = computePayoutStatus({
            expectedAmount: 10000,
            receivedAmount: 0,
            expectedDate: '2026-02-01',
            dateEstimated: false,
            today: '2026-01-15',
        });
        assert.strictEqual(result.status, 'PENDING');
        assert.strictEqual(result.outstandingAmount, 10000);
        assert.strictEqual(result.daysOverdue, 0);
        assert.strictEqual(result.isOverdue, false);
    });

    it('computes OVERDUE when expectedDate < today, dateEstimated is false, and outstanding > 0', () => {
        const result = computePayoutStatus({
            expectedAmount: 10000,
            receivedAmount: 0,
            expectedDate: '2026-01-10',
            dateEstimated: false,
            today: '2026-01-15',
        });
        assert.strictEqual(result.status, 'OVERDUE');
        assert.strictEqual(result.daysOverdue, 5);
        assert.strictEqual(result.isOverdue, true);
    });

    it('dateEstimated = true payouts are NOT counted as OVERDUE even if past expected date', () => {
        const result = computePayoutStatus({
            expectedAmount: 10000,
            receivedAmount: 0,
            expectedDate: '2026-01-01',
            dateEstimated: true,
            today: '2026-01-15',
        });
        // Should remain PENDING instead of OVERDUE
        assert.strictEqual(result.status, 'PENDING');
        assert.strictEqual(result.isOverdue, false);
        assert.strictEqual(result.daysOverdue, 0);
    });
});
