/**
 * Pure calculation functions for CC / Stock-Funding facility management.
 * All calendar math operates using Asia/Kolkata (IST) calendar dates (UTC+05:30).
 */

export const DEFAULT_GRACE_DAYS = 60;
export const REMINDER_INTERVAL_DAYS = 10;

export type FundingDrawStatus = 'OPEN' | 'PARTIAL' | 'REPAID' | 'OVERDUE';

export type FundingReminderLevel =
    | 'OVERDUE'
    | 'DUE_TODAY'
    | 'DUE_TOMORROW'
    | 'DUE_WITHIN_10_DAYS'
    | 'DUE_WITHIN_20_DAYS'
    | 'DUE_WITHIN_30_DAYS';

export interface FundingReminderAlert {
    drawId: string;
    facilityId: string;
    facilityKey: string;
    bankName: string;
    productCode: string;
    amount: number;
    outstanding: number;
    drawDate: string;
    dueDate: string;
    daysLeft: number;
    level: FundingReminderLevel;
    levelLabel: string;
    isOverdue: boolean;
}

/**
 * Returns the current date formatted as YYYY-MM-DD in Asia/Kolkata timezone.
 */
export function getTodayIST(now: Date = new Date()): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return formatter.format(now);
}

/**
 * Converts a Date or string to YYYY-MM-DD in Asia/Kolkata timezone.
 */
export function toCalendarDateIST(date: string | Date): string {
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
    }
    const d = new Date(date);
    return getTodayIST(d);
}

/**
 * Adds calendar days to an IST YYYY-MM-DD string.
 */
export function addDaysToDateString(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    // Use UTC date constructor to avoid local browser timezone shifts
    const utcDate = new Date(Date.UTC(y, m - 1, d));
    utcDate.setUTCDate(utcDate.getUTCDate() + days);
    const year = utcDate.getUTCFullYear();
    const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(utcDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Calculates calendar day difference between date2 and date1 (date2 - date1).
 */
export function differenceInCalendarDays(dateStr2: string, dateStr1: string): number {
    const [y1, m1, d1] = dateStr1.split('-').map(Number);
    const [y2, m2, d2] = dateStr2.split('-').map(Number);
    const utc1 = Date.UTC(y1, m1 - 1, d1);
    const utc2 = Date.UTC(y2, m2 - 1, d2);
    return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

/**
 * Calculates due date given a draw date and grace days.
 * If graceDays is null/undefined or <= 0, uses DEFAULT_GRACE_DAYS (60).
 */
export function calculateFundingDueDate(
    drawDate: string | Date,
    graceDays?: number | null,
): { dueDate: string; effectiveGraceDays: number; isDefault: boolean } {
    const dateStr = toCalendarDateIST(drawDate);
    const isDefault = graceDays == null || graceDays <= 0;
    const effectiveGraceDays = isDefault ? DEFAULT_GRACE_DAYS : graceDays;
    const dueDate = addDaysToDateString(dateStr, effectiveGraceDays);
    return { dueDate, effectiveGraceDays, isDefault };
}

/**
 * Calculates outstanding balance for a draw given repayments.
 */
export function calculateDrawOutstanding(
    drawAmount: number,
    repayments: Array<{ amount: number }>,
): { totalRepaid: number; outstanding: number } {
    const totalRepaid = repayments.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const outstanding = Math.max(0, Math.round((drawAmount - totalRepaid) * 100) / 100);
    return { totalRepaid: Math.round(totalRepaid * 100) / 100, outstanding };
}

/**
 * Calculates facility limits and utilisation.
 */
export function calculateFacilityMetrics(
    sanctionedLimit: number,
    totalUsed: number,
): {
    sanctionedLimit: number;
    totalUsed: number;
    available: number;
    utilisationPercent: number;
    isOverLimit: boolean;
} {
    const used = Math.round(totalUsed * 100) / 100;
    const available = Math.round((sanctionedLimit - used) * 100) / 100;
    const utilisationPercent =
        sanctionedLimit > 0 ? Math.round((used / sanctionedLimit) * 100) : 0;
    const isOverLimit = used > sanctionedLimit;
    return {
        sanctionedLimit,
        totalUsed: used,
        available,
        utilisationPercent,
        isOverLimit,
    };
}

/**
 * Calculates accrued interest so far (provisional simple interest):
 * Formula: outstanding * (ROI / 100) * days / 365
 * - If ROI is null: returns null ("Not set")
 * - If draw is fully repaid: returns 0 (not null)
 */
export function calculateInterestSoFar(
    outstanding: number,
    roiPercent: number | null | undefined,
    drawDate: string | Date,
    asOfDate: string | Date = getTodayIST(),
): number | null {
    if (roiPercent == null) {
        return null;
    }
    if (outstanding <= 0) {
        return 0;
    }
    const drawDateStr = toCalendarDateIST(drawDate);
    const asOfDateStr = toCalendarDateIST(asOfDate);
    const daysElapsed = Math.max(0, differenceInCalendarDays(asOfDateStr, drawDateStr));
    const annualRate = roiPercent / 100;
    const interest = outstanding * annualRate * (daysElapsed / 365);
    return Math.round(interest * 100) / 100;
}

/**
 * Determines the status of a funding draw:
 * - REPAID: outstanding <= 0
 * - OVERDUE: outstanding > 0 && daysLeft < 0
 * - PARTIAL: outstanding > 0 && totalRepaid > 0 && daysLeft >= 0
 * - OPEN: outstanding > 0 && totalRepaid === 0 && daysLeft >= 0
 */
export function getFundingDrawStatus(
    drawAmount: number,
    totalRepaid: number,
    dueDate: string,
    today: string = getTodayIST(),
): FundingDrawStatus {
    const outstanding = Math.max(0, drawAmount - totalRepaid);
    if (outstanding <= 0) {
        return 'REPAID';
    }
    const daysLeft = differenceInCalendarDays(dueDate, today);
    if (daysLeft < 0) {
        return 'OVERDUE';
    }
    if (totalRepaid > 0) {
        return 'PARTIAL';
    }
    return 'OPEN';
}

/**
 * Evaluates the reminder alert for a draw based on the reminder rule:
 * Alert is active while outstanding > 0 and daysLeft <= 30.
 * Levels:
 * - "Overdue": daysLeft < 0
 * - "Due today": daysLeft === 0
 * - "Due tomorrow": daysLeft === 1
 * - "Due within 10 days": 2 <= daysLeft <= 10
 * - "Due within 20 days": 11 <= daysLeft <= 20
 * - "Due within 30 days": 21 <= daysLeft <= 30
 * If grace period is shorter than 30 days, alerts only fire within the facility's period.
 */
export function getFundingReminder(
    draw: {
        id: string;
        facilityId: string;
        amount: number;
        drawDate: string | Date;
        facility: {
            facilityKey: string;
            bankName: string;
            productCode: string;
            graceDays?: number | null;
        };
        repayments?: Array<{ amount: number }>;
    },
    today: string = getTodayIST(),
): FundingReminderAlert | null {
    const { outstanding } = calculateDrawOutstanding(
        draw.amount,
        draw.repayments || [],
    );
    if (outstanding <= 0) {
        return null; // Fully repaid draws never alert
    }

    const { dueDate, effectiveGraceDays } = calculateFundingDueDate(
        draw.drawDate,
        draw.facility.graceDays,
    );
    const daysLeft = differenceInCalendarDays(dueDate, today);

    // If draw is not yet within 30 days, or outside facility period
    if (daysLeft > 30 || daysLeft > effectiveGraceDays) {
        return null;
    }

    let level: FundingReminderLevel;
    let levelLabel: string;
    let isOverdue = false;

    if (daysLeft < 0) {
        level = 'OVERDUE';
        levelLabel = 'Overdue';
        isOverdue = true;
    } else if (daysLeft === 0) {
        level = 'DUE_TODAY';
        levelLabel = 'Due today';
    } else if (daysLeft === 1) {
        level = 'DUE_TOMORROW';
        levelLabel = 'Due tomorrow';
    } else if (daysLeft <= 10) {
        level = 'DUE_WITHIN_10_DAYS';
        levelLabel = 'Due within 10 days';
    } else if (daysLeft <= 20) {
        level = 'DUE_WITHIN_20_DAYS';
        levelLabel = 'Due within 20 days';
    } else {
        level = 'DUE_WITHIN_30_DAYS';
        levelLabel = 'Due within 30 days';
    }

    return {
        drawId: draw.id,
        facilityId: draw.facilityId,
        facilityKey: draw.facility.facilityKey,
        bankName: draw.facility.bankName,
        productCode: draw.facility.productCode,
        amount: draw.amount,
        outstanding,
        drawDate: toCalendarDateIST(draw.drawDate),
        dueDate,
        daysLeft,
        level,
        levelLabel,
        isOverdue,
    };
}
