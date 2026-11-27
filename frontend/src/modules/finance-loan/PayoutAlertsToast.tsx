import { useEffect, useState, useRef, useCallback } from 'react';
import './PayoutAlertsBell.css';

export interface PayoutAlertsToastProps {
    overdueCount: number;
    dueSoonCount: number;
    customMessage?: string;
    viewUrl?: string;
    onClose: () => void;
}

export function PayoutAlertsToast({
    overdueCount,
    dueSoonCount,
    customMessage,
    viewUrl,
    onClose,
}: PayoutAlertsToastProps) {
    const [isVisible, setIsVisible] = useState(true);
    const remainingTimeRef = useRef(10000); // 10 seconds total
    const startTimeRef = useRef<number>(0);
    const timerIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isPausedRef = useRef(false);

    const handleClose = useCallback(() => {
        if (timerIdRef.current) {
            clearTimeout(timerIdRef.current);
            timerIdRef.current = null;
        }
        setIsVisible(false);
        onClose();
    }, [onClose]);

    const startTimer = useCallback(
        (duration: number) => {
            if (timerIdRef.current) {
                clearTimeout(timerIdRef.current);
            }
            startTimeRef.current = Date.now();
            timerIdRef.current = setTimeout(() => {
                handleClose();
            }, duration);
        },
        [handleClose],
    );

    // Initial 10-second timer
    useEffect(() => {
        startTimer(10000);
        return () => {
            if (timerIdRef.current) {
                clearTimeout(timerIdRef.current);
            }
        };
    }, [startTimer]);

    // Pause timer on mouse hover
    const handleMouseEnter = () => {
        if (timerIdRef.current) {
            clearTimeout(timerIdRef.current);
            timerIdRef.current = null;
            const elapsed = Date.now() - startTimeRef.current;
            remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
            isPausedRef.current = true;
        }
    };

    // Resume timer on mouse leave
    const handleMouseLeave = () => {
        if (isPausedRef.current && remainingTimeRef.current > 0) {
            isPausedRef.current = false;
            startTimer(remainingTimeRef.current);
        }
    };

    const hasOverdue = overdueCount > 0;
    const hasDueSoon = dueSoonCount > 0;

    // If neither count is > 0, don't show
    if (!hasOverdue && !hasDueSoon) {
        return null;
    }

    // Text: "⚠ X payouts overdue · Y due today/tomorrow" (show only parts with counts > 0)
    const textParts: string[] = [];
    if (hasOverdue) {
        textParts.push(`${overdueCount} payout${overdueCount === 1 ? '' : 's'} overdue`);
    }
    if (hasDueSoon) {
        textParts.push(`${dueSoonCount} due today/tomorrow`);
    }
    const message = customMessage || `⚠ ${textParts.join(' · ')}`;

    // Red style if any overdue, amber if only due soon
    const styleClass = hasOverdue ? 'payout-toast-red' : 'payout-toast-amber';

    // Link opens Payout Tracker or specified viewUrl
    const handleViewClick = () => {
        handleClose();
        const target = viewUrl || '/finance-loan?tab=payouts';
        if (window.location.pathname === '/finance-loan') {
            const urlObj = new URL(target, window.location.origin);
            window.history.pushState({}, '', urlObj.pathname + urlObj.search);
            window.dispatchEvent(new CustomEvent('nexus:navigate-tab', { detail: { search: urlObj.search } }));
            window.dispatchEvent(new PopStateEvent('popstate'));
        } else {
            window.location.href = target;
        }
    };

    if (!isVisible) {
        return null;
    }

    return (
        <div
            className={`payout-alerts-toast ${styleClass}`}
            role="status"
            aria-live="polite"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div className="payout-toast-content">
                <span className="payout-toast-message">{message}</span>
                <div className="payout-toast-actions">
                    <button
                        type="button"
                        className="payout-toast-view-btn"
                        onClick={handleViewClick}
                    >
                        View
                    </button>
                    <button
                        type="button"
                        className="payout-toast-close-btn"
                        onClick={handleClose}
                        aria-label="Close alert pop-up"
                    >
                        ×
                    </button>
                </div>
            </div>
        </div>
    );
}
