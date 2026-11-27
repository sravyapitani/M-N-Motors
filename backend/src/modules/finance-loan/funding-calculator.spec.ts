import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
    calculateFundingDueDate,
    calculateDrawOutstanding,
    calculateFacilityMetrics,
    calculateInterestSoFar,
    getFundingDrawStatus,
    getFundingReminder,
    DEFAULT_GRACE_DAYS,
} from './funding-calculator';

describe('Funding Calculator & Reminder Pure Logic', () => {
    describe('1. Due Date Calculation & 60-Day Default', () => {
        it('should use DEFAULT_GRACE_DAYS (60 days) when graceDays is null', () => {
            const drawDate = '2026-10-01';
            const { dueDate, effectiveGraceDays, isDefault } = calculateFundingDueDate(
                drawDate,
                null,
            );
            assert.equal(effectiveGraceDays, 60);
            assert.equal(isDefault, true);
            // 2026-10-01 + 60 days: 30 days left in Oct (to Oct 31) + 30 days in Nov -> 2026-11-30
            assert.equal(dueDate, '2026-11-30');
        });

        it('should use DEFAULT_GRACE_DAYS (60 days) when graceDays is undefined', () => {
            const drawDate = '2026-01-01';
            const { dueDate, effectiveGraceDays, isDefault } = calculateFundingDueDate(
                drawDate,
                undefined,
            );
            assert.equal(effectiveGraceDays, DEFAULT_GRACE_DAYS);
            assert.equal(isDefault, true);
            // 2026-01-01 + 60 days: 30 days in Jan + 28 days in Feb + 2 in Mar -> 2026-03-02
            assert.equal(dueDate, '2026-03-02');
        });

        it('should use custom graceDays when provided', () => {
            const drawDate = '2026-05-01';
            const { dueDate, effectiveGraceDays, isDefault } = calculateFundingDueDate(
                drawDate,
                45,
            );
            assert.equal(effectiveGraceDays, 45);
            assert.equal(isDefault, false);
            // 2026-05-01 + 45 days: 30 days left in May (to May 31) + 15 in Jun -> 2026-06-15
            assert.equal(dueDate, '2026-06-15');
        });

        it('should map null graceDays to 60 days default', () => {
            const { effectiveGraceDays, isDefault } = calculateFundingDueDate('2026-04-01', null);
            assert.equal(effectiveGraceDays, 60);
            assert.equal(isDefault, true);
        });

        it('should map explicit 52 graceDays to 52 days (not default)', () => {
            const { effectiveGraceDays, isDefault } = calculateFundingDueDate('2026-04-01', 52);
            assert.equal(effectiveGraceDays, 52);
            assert.equal(isDefault, false);
        });
    });

    describe('2. Outstanding Draw Calculation', () => {
        it('should return full draw amount when zero repayments have been made', () => {
            const { totalRepaid, outstanding } = calculateDrawOutstanding(1000000, []);
            assert.equal(totalRepaid, 0);
            assert.equal(outstanding, 1000000);
        });

        it('should subtract partial repayments correctly', () => {
            const { totalRepaid, outstanding } = calculateDrawOutstanding(1000000, [
                { amount: 300000 },
                { amount: 250000 },
            ]);
            assert.equal(totalRepaid, 550000);
            assert.equal(outstanding, 450000);
        });

        it('should return zero outstanding when fully repaid and not go negative', () => {
            const { totalRepaid, outstanding } = calculateDrawOutstanding(1000000, [
                { amount: 1000000 },
            ]);
            assert.equal(totalRepaid, 1000000);
            assert.equal(outstanding, 0);
        });
    });

    describe('3. Facility Limit & Utilisation Metrics', () => {
        it('should calculate available limit and utilisation percentage correctly', () => {
            const limit = 50000000; // 5 Cr
            const used = 20000000; // 2 Cr
            const metrics = calculateFacilityMetrics(limit, used);
            assert.equal(metrics.available, 30000000);
            assert.equal(metrics.utilisationPercent, 40);
            assert.equal(metrics.isOverLimit, false);
        });

        it('should detect over-limit condition and allow negative available', () => {
            const limit = 50000000;
            const used = 55000000; // 5.5 Cr
            const metrics = calculateFacilityMetrics(limit, used);
            assert.equal(metrics.available, -5000000);
            assert.equal(metrics.utilisationPercent, 110);
            assert.equal(metrics.isOverLimit, true);
        });
    });

    describe('4. Interest so far (approx.) Calculation', () => {
        it('should return null ("Not set") when ROI is null or undefined', () => {
            const interest = calculateInterestSoFar(
                10000000,
                null,
                '2026-05-01',
                '2026-05-31',
            );
            assert.equal(interest, null);
        });

        it('should return 0 when draw is fully repaid (outstanding <= 0), not null', () => {
            const interest = calculateInterestSoFar(
                0,
                9.5,
                '2026-05-01',
                '2026-05-31',
            );
            assert.equal(interest, 0);
        });

        it('should calculate simple interest correctly for elapsed days', () => {
            // Outstanding: 1,00,00,000 (1 Cr), ROI: 9.125% p.a., 30 days elapsed
            // 10,000,000 * 0.09125 * 30 / 365 = 75,000.00
            const interest = calculateInterestSoFar(
                10000000,
                9.125,
                '2026-06-01',
                '2026-07-01',
            );
            assert.equal(interest, 75000);
        });
    });

    describe('5. Draw Status Evaluation', () => {
        const dueDate = '2026-07-15';

        it('should return REPAID when outstanding is 0', () => {
            const status = getFundingDrawStatus(500000, 500000, dueDate, '2026-07-01');
            assert.equal(status, 'REPAID');
        });

        it('should return OVERDUE when today is after due date and outstanding > 0', () => {
            const status = getFundingDrawStatus(500000, 0, dueDate, '2026-07-16');
            assert.equal(status, 'OVERDUE');
        });

        it('should return PARTIAL when some amount is repaid before due date', () => {
            const status = getFundingDrawStatus(500000, 100000, dueDate, '2026-07-10');
            assert.equal(status, 'PARTIAL');
        });

        it('should return OPEN when zero repaid and today <= due date', () => {
            const status = getFundingDrawStatus(500000, 0, dueDate, '2026-07-10');
            assert.equal(status, 'OPEN');
        });
    });

    describe('6. Reminder Levels & Notification Rules', () => {
        const baseDraw = {
            id: 'draw-1',
            facilityId: 'fac-1',
            facility: {
                facilityKey: 'AXIS-CC-1',
                bankName: 'Axis Bank',
                productCode: 'CC',
                graceDays: 60,
            },
            amount: 5000000,
            drawDate: '2026-06-01', // Due date = 2026-06-01 + 60 days = 2026-07-31
            repayments: [],
        };

        it('should suppress reminders if draw is fully repaid', () => {
            const repaidDraw = {
                ...baseDraw,
                repayments: [{ amount: 5000000 }],
            };
            const alert = getFundingReminder(repaidDraw, '2026-07-31');
            assert.equal(alert, null);
        });

        it('should return null when daysLeft > 30 (not yet in reminder window)', () => {
            // Due: 2026-07-31, Today: 2026-06-25 -> 36 days left
            const alert = getFundingReminder(baseDraw, '2026-06-25');
            assert.equal(alert, null);
        });

        it('should return "Due within 30 days" when 21 <= daysLeft <= 30', () => {
            // Due: 2026-07-31, Today: 2026-07-06 -> 25 days left
            const alert = getFundingReminder(baseDraw, '2026-07-06');
            assert.ok(alert);
            assert.equal(alert.level, 'DUE_WITHIN_30_DAYS');
            assert.equal(alert.levelLabel, 'Due within 30 days');
            assert.equal(alert.daysLeft, 25);
            assert.equal(alert.isOverdue, false);
        });

        it('should return "Due within 20 days" when 11 <= daysLeft <= 20', () => {
            // Due: 2026-07-31, Today: 2026-07-16 -> 15 days left
            const alert = getFundingReminder(baseDraw, '2026-07-16');
            assert.ok(alert);
            assert.equal(alert.level, 'DUE_WITHIN_20_DAYS');
            assert.equal(alert.levelLabel, 'Due within 20 days');
            assert.equal(alert.daysLeft, 15);
        });

        it('should return "Due within 10 days" when 2 <= daysLeft <= 10', () => {
            // Due: 2026-07-31, Today: 2026-07-26 -> 5 days left
            const alert = getFundingReminder(baseDraw, '2026-07-26');
            assert.ok(alert);
            assert.equal(alert.level, 'DUE_WITHIN_10_DAYS');
            assert.equal(alert.levelLabel, 'Due within 10 days');
            assert.equal(alert.daysLeft, 5);
        });

        it('should return "Due tomorrow" when daysLeft === 1', () => {
            // Due: 2026-07-31, Today: 2026-07-30 -> 1 day left
            const alert = getFundingReminder(baseDraw, '2026-07-30');
            assert.ok(alert);
            assert.equal(alert.level, 'DUE_TOMORROW');
            assert.equal(alert.levelLabel, 'Due tomorrow');
            assert.equal(alert.daysLeft, 1);
        });

        it('should return "Due today" when daysLeft === 0', () => {
            // Due: 2026-07-31, Today: 2026-07-31 -> 0 days left
            const alert = getFundingReminder(baseDraw, '2026-07-31');
            assert.ok(alert);
            assert.equal(alert.level, 'DUE_TODAY');
            assert.equal(alert.levelLabel, 'Due today');
            assert.equal(alert.daysLeft, 0);
        });

        it('should return "Overdue" when daysLeft < 0', () => {
            // Due: 2026-07-31, Today: 2026-08-05 -> -5 days
            const alert = getFundingReminder(baseDraw, '2026-08-05');
            assert.ok(alert);
            assert.equal(alert.level, 'OVERDUE');
            assert.equal(alert.levelLabel, 'Overdue');
            assert.equal(alert.daysLeft, -5);
            assert.equal(alert.isOverdue, true);
        });

        it('should handle short grace period (e.g. 15 days) and only alert within period', () => {
            const shortDraw = {
                ...baseDraw,
                facility: {
                    ...baseDraw.facility,
                    graceDays: 15,
                },
                drawDate: '2026-08-01', // Due: 2026-08-16 (15 days)
            };
            // 20 days before due would be 2026-07-27 (before draw happened!), so daysLeft = 14 falls in "Due within 20 days"
            const alert = getFundingReminder(shortDraw, '2026-08-02');
            assert.ok(alert);
            assert.equal(alert.level, 'DUE_WITHIN_20_DAYS');
            assert.equal(alert.daysLeft, 14);
        });
    });

    describe('7. Axis Two-CC Lines Distinguishability', () => {
        it('should allow distinct tracking for two Axis Bank CC facilities via facilityKey', () => {
            const facility1 = {
                facilityKey: 'AXIS-CC-1',
                bankName: 'Axis Bank',
                productCode: 'CC',
                sanctionedLimit: 25000000,
                graceDays: 60,
            };
            const facility2 = {
                facilityKey: 'AXIS-CC-2',
                bankName: 'Axis Bank',
                productCode: 'CC',
                sanctionedLimit: 15000000,
                graceDays: 45,
            };

            assert.notEqual(facility1.facilityKey, facility2.facilityKey);
            assert.equal(facility1.bankName, facility2.bankName);
            assert.equal(facility1.productCode, facility2.productCode);

            const due1 = calculateFundingDueDate('2026-09-01', facility1.graceDays);
            const due2 = calculateFundingDueDate('2026-09-01', facility2.graceDays);

            assert.equal(due1.effectiveGraceDays, 60);
            assert.equal(due2.effectiveGraceDays, 45);
            assert.equal(due1.dueDate, '2026-10-31');
            assert.equal(due2.dueDate, '2026-10-16');
        });
    });
});
