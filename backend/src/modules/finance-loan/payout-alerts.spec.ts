import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  classifyPayoutAlert,
  diffCalendarDaysKolkata,
  getKolkataCalendarDate,
  type PayoutAlertInput,
} from './payout-alerts';

describe('Payout Alerts Classification & Kolkata Date Logic', () => {
  // Fixed reference time: 2026-11-26 12:00:00 IST (06:30:00 UTC)
  // Calendar date in Kolkata is 2026-11-26.
  const referenceNow = new Date('2026-11-26T06:30:00.000Z');

  const baseInput: PayoutAlertInput = {
    payoutId: 'payout-1',
    loanId: 'loan-1',
    customerName: 'Anil Kumar',
    branchId: 'branch-kkd',
    branchCode: 'KKD',
    branchName: 'Kakinada',
    lenderId: 'lender-hdfc',
    lenderName: 'HDFC Bank',
    kind: 'LOAN_AMOUNT',
    expectedAmount: 500000,
    receivedAmount: 0,
    expectedDate: '2026-11-26T00:00:00.000Z',
    dateEstimated: false,
    status: 'PENDING',
  };

  it('1. due today: expectedDate is today in Kolkata time, outstanding > 0 -> DUE_SOON (daysLeft = 0)', () => {
    // 2026-11-26 10:00 IST (04:30 UTC)
    const alert = classifyPayoutAlert(
      {
        ...baseInput,
        expectedDate: new Date('2026-11-26T04:30:00.000Z'),
      },
      referenceNow,
    );

    assert.ok(alert);
    assert.strictEqual(alert?.alertType, 'DUE_SOON');
    assert.strictEqual(alert?.daysDifference, 0);
    assert.strictEqual(alert?.urgencyLabel, 'Due today');
    assert.strictEqual(alert?.outstandingAmount, 500000);
    assert.strictEqual(alert?.typeLabel, 'DO amount');
  });

  it('2. due tomorrow: expectedDate is tomorrow in Kolkata time, outstanding > 0 -> DUE_SOON (daysLeft = 1)', () => {
    // 2026-11-27 10:00 IST (04:30 UTC)
    const alert = classifyPayoutAlert(
      {
        ...baseInput,
        expectedDate: new Date('2026-11-27T04:30:00.000Z'),
      },
      referenceNow,
    );

    assert.ok(alert);
    assert.strictEqual(alert?.alertType, 'DUE_SOON');
    assert.strictEqual(alert?.daysDifference, 1);
    assert.strictEqual(alert?.urgencyLabel, 'Due tomorrow');
  });

  it('3. due in 2 days: expectedDate is today + 2 days, outstanding > 0 -> no alert (null)', () => {
    // 2026-11-28 10:00 IST (04:30 UTC)
    const alert = classifyPayoutAlert(
      {
        ...baseInput,
        expectedDate: new Date('2026-11-28T04:30:00.000Z'),
      },
      referenceNow,
    );

    assert.strictEqual(alert, null);
  });

  it('4. overdue: expectedDate is before today, outstanding > 0, dateEstimated = false -> OVERDUE', () => {
    // 2026-11-20 10:00 IST (6 days before Nov 26)
    const alert = classifyPayoutAlert(
      {
        ...baseInput,
        kind: 'COMMISSION',
        expectedAmount: 14160,
        receivedAmount: 0,
        expectedDate: new Date('2026-11-20T04:30:00.000Z'),
        dateEstimated: false,
      },
      referenceNow,
    );

    assert.ok(alert);
    assert.strictEqual(alert?.alertType, 'OVERDUE');
    assert.strictEqual(alert?.daysDifference, -6);
    assert.strictEqual(alert?.urgencyLabel, '6 days overdue');
    assert.strictEqual(alert?.typeLabel, 'Commission');
  });

  it('5. received: expectedDate is past or today, but outstanding = 0 (or status RECEIVED) -> no alert (null)', () => {
    // Past date but fully received
    const fullyReceived = classifyPayoutAlert(
      {
        ...baseInput,
        expectedDate: new Date('2026-11-20T04:30:00.000Z'),
        receivedAmount: 500000,
      },
      referenceNow,
    );
    assert.strictEqual(fullyReceived, null);

    // Status explicitly RECEIVED
    const statusReceived = classifyPayoutAlert(
      {
        ...baseInput,
        expectedDate: new Date('2026-11-26T04:30:00.000Z'),
        status: 'RECEIVED',
      },
      referenceNow,
    );
    assert.strictEqual(statusReceived, null);
  });

  it('6. estimated date: expectedDate is past, outstanding > 0, dateEstimated = true -> DATE_TO_CONFIRM (not overdue)', () => {
    // Past date but marked as dateEstimated = true
    const alert = classifyPayoutAlert(
      {
        ...baseInput,
        expectedDate: new Date('2026-11-15T04:30:00.000Z'),
        dateEstimated: true,
      },
      referenceNow,
    );

    assert.ok(alert);
    assert.notStrictEqual(alert?.alertType, 'OVERDUE');
    assert.strictEqual(alert?.alertType, 'DATE_TO_CONFIRM');
    assert.strictEqual(alert?.urgencyLabel, 'Date to confirm');
    assert.strictEqual(alert?.dateEstimated, true);
  });

  it('7. Kolkata midnight boundary: 23:30 UTC yesterday corresponds to 05:00 IST today -> Due today, not overdue', () => {
    // 2026-11-25 23:30:00 UTC = 2026-11-26 05:00:00 IST
    // Raw UTC calendar date is Nov 25 (yesterday), but Kolkata calendar date is Nov 26 (today).
    const boundaryTimestamp = new Date('2026-11-25T23:30:00.000Z');

    const kolkataDate = getKolkataCalendarDate(boundaryTimestamp);
    assert.strictEqual(kolkataDate.dateStr, '2026-11-26');

    const daysDiff = diffCalendarDaysKolkata(boundaryTimestamp, referenceNow);
    assert.strictEqual(daysDiff, 0);

    const alert = classifyPayoutAlert(
      {
        ...baseInput,
        expectedDate: boundaryTimestamp,
      },
      referenceNow,
    );

    assert.ok(alert);
    assert.strictEqual(alert?.alertType, 'DUE_SOON');
    assert.strictEqual(alert?.urgencyLabel, 'Due today');
    assert.notStrictEqual(alert?.alertType, 'OVERDUE');
  });

  it('8. branch scoping: alert filters respect user branch boundaries vs admin', () => {
    const alerts: PayoutAlertInput[] = [
      { ...baseInput, payoutId: 'p1', branchId: 'branch-kkd', branchCode: 'KKD' },
      { ...baseInput, payoutId: 'p2', branchId: 'branch-tnk', branchCode: 'TNK' },
      { ...baseInput, payoutId: 'p3', branchId: 'branch-elr', branchCode: 'ELR' },
    ];

    // Branch staff user assigned only to KKD
    const kkdUserBranchIds = ['branch-kkd'];
    const kkdAlerts = alerts
      .filter((a) => kkdUserBranchIds.includes(a.branchId))
      .map((a) => classifyPayoutAlert(a, referenceNow))
      .filter(Boolean);

    assert.strictEqual(kkdAlerts.length, 1);
    assert.strictEqual(kkdAlerts[0]?.branchCode, 'KKD');

    // Admin user assigned to all branches
    const adminAlerts = alerts
      .map((a) => classifyPayoutAlert(a, referenceNow))
      .filter(Boolean);

    assert.strictEqual(adminAlerts.length, 3);
  });
});
