import { createRoot, type Root } from 'react-dom/client';
import React from 'react';
import type { PayoutAlert } from './PayoutAlertsBell';
import { PayoutAlertsToast } from './PayoutAlertsToast';

const STORAGE_KEY = 'nexus_payout_alerts_toast_shown_ids';
const CC_STORAGE_KEY = 'nexus_cc_alerts_toast_shown_levels';
let fallbackShownThisSession = false;

/**
 * Checks if the toast should be shown for the current list of alerts.
 * - Shows only if there are overdue or due soon payouts.
 * - Shows once per session, or again if a new payout appears that was not shown before.
 */
export function shouldShowPayoutAlertsToast(alerts: PayoutAlert[]): boolean {
    const activeAlerts = alerts.filter(
        (a) => a.alertType === 'OVERDUE' || a.alertType === 'DUE_SOON',
    );
    if (activeAlerts.length === 0) return false;

    const currentIds = activeAlerts.map((a) => a.payoutId);

    try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return true;
        }
        const shownIds: string[] = JSON.parse(stored);
        // Show again only if a payout appears in alerts that was not there when last shown
        const hasNewPayout = currentIds.some((id) => !shownIds.includes(id));
        return hasNewPayout;
    } catch {
        // If storage fails, show once per page load
        if (!fallbackShownThisSession) {
            fallbackShownThisSession = true;
            return true;
        }
        return false;
    }
}

/**
 * Records the current alert payout IDs in sessionStorage.
 */
export function markPayoutAlertsToastShown(alerts: PayoutAlert[]): void {
    const activeAlerts = alerts.filter(
        (a) => a.alertType === 'OVERDUE' || a.alertType === 'DUE_SOON',
    );
    const currentIds = activeAlerts.map((a) => a.payoutId);

    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(currentIds));
    } catch {
        // ignore
        fallbackShownThisSession = true;
    }
}

export interface FundingToastAlert {
    drawId: string;
    level: string;
    isOverdue: boolean;
}

/**
 * Checks if toast should be shown for CC funding reminder alerts.
 * Shows again when a draw moves to a new level (tracked via drawId:level in sessionStorage).
 */
export function shouldShowFundingAlertsToast(alerts: FundingToastAlert[]): boolean {
    if (!alerts || alerts.length === 0) return false;
    const currentKeys = alerts.map((a) => `${a.drawId}:${a.level}`);
    try {
        const stored = sessionStorage.getItem(CC_STORAGE_KEY);
        if (!stored) {
            return true;
        }
        const shownKeys: string[] = JSON.parse(stored);
        return currentKeys.some((k) => !shownKeys.includes(k));
    } catch {
        return true;
    }
}

/**
 * Marks current CC funding drawId:level keys in sessionStorage.
 */
export function markFundingAlertsToastShown(alerts: FundingToastAlert[]): void {
    const currentKeys = alerts.map((a) => `${a.drawId}:${a.level}`);
    try {
        sessionStorage.setItem(CC_STORAGE_KEY, JSON.stringify(currentKeys));
    } catch {
        // ignore
    }
}

// Global active toast root tracker to ensure only one toast instance exists
let activeToastRoot: Root | null = null;
let activeToastContainer: HTMLElement | null = null;

function cleanupExistingToast() {
    if (activeToastRoot && activeToastContainer) {
        try {
            activeToastRoot.unmount();
        } catch {
            // ignore
        }
        if (activeToastContainer.parentNode) {
            activeToastContainer.parentNode.removeChild(activeToastContainer);
        }
        activeToastRoot = null;
        activeToastContainer = null;
    }
}

/**
 * Spawns the toast notification at top-right below the header for payout alerts.
 */
export function spawnPayoutAlertsToast(
    overdueCount: number,
    dueSoonCount: number,
    targetPayoutId?: string,
) {
    cleanupExistingToast();

    const container = document.createElement('div');
    container.id = 'payout-alerts-toast-root';
    document.body.appendChild(container);

    const root = createRoot(container);
    activeToastRoot = root;
    activeToastContainer = container;

    const cleanup = () => {
        setTimeout(() => {
            if (activeToastRoot === root) {
                try {
                    root.unmount();
                } catch {
                    // ignore
                }
                if (container.parentNode) {
                    container.parentNode.removeChild(container);
                }
                activeToastRoot = null;
                activeToastContainer = null;
            }
        }, 150);
    };

    let viewUrl = '/finance-loan?tab=payouts';
    if (targetPayoutId) {
        viewUrl = `/finance-loan?tab=payouts&payoutId=${encodeURIComponent(targetPayoutId)}`;
    } else if (overdueCount > 0) {
        viewUrl = '/finance-loan?tab=payouts&overdue=true';
    }

    root.render(
        React.createElement(PayoutAlertsToast, {
            overdueCount,
            dueSoonCount,
            viewUrl,
            onClose: cleanup,
        }),
    );
}

/**
 * Spawns the toast notification at top-right below the header for CC funding alerts.
 */
export function spawnFundingAlertsToast(
    overdueCount: number,
    dueSoonCount: number,
    targetDrawId?: string,
) {
    cleanupExistingToast();

    const container = document.createElement('div');
    container.id = 'funding-alerts-toast-root';
    document.body.appendChild(container);

    const root = createRoot(container);
    activeToastRoot = root;
    activeToastContainer = container;

    const cleanup = () => {
        setTimeout(() => {
            if (activeToastRoot === root) {
                try {
                    root.unmount();
                } catch {
                    // ignore
                }
                if (container.parentNode) {
                    container.parentNode.removeChild(container);
                }
                activeToastRoot = null;
                activeToastContainer = null;
            }
        }, 150);
    };

    const textParts: string[] = [];
    if (overdueCount > 0) {
        textParts.push(`${overdueCount} draw${overdueCount === 1 ? '' : 's'} overdue`);
    }
    if (dueSoonCount > 0) {
        textParts.push(`${dueSoonCount} due soon`);
    }
    const customMessage = `⚠ CC Funding: ${textParts.join(' · ')}`;

    let viewUrl = '/finance-loan?tab=funding';
    if (targetDrawId) {
        viewUrl = `/finance-loan?tab=funding&drawId=${encodeURIComponent(targetDrawId)}`;
    } else if (overdueCount > 0) {
        viewUrl = '/finance-loan?tab=funding&overdue=true';
    }

    root.render(
        React.createElement(PayoutAlertsToast, {
            overdueCount,
            dueSoonCount,
            customMessage,
            viewUrl,
            onClose: cleanup,
        }),
    );
}
