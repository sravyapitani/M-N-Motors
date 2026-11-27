import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiRequest, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

export interface FundingFacilityItem {
    id: string;
    facilityKey: string;
    bankName: string;
    productCode: string;
    facilityType: 'CC' | 'INVENTORY' | 'OTHER';
    sanctionedLimit: number;
    roiPercent: number | null;
    graceDays: number | null;
    effectiveGraceDays: number;
    isDefaultGrace: boolean;
    isActive: boolean;
    lenderId?: string | null;
    lenderName?: string | null;
    totalUsed: number;
    available: number;
    utilisationPercent: number;
    isOverLimit: boolean;
    activeDrawsCount: number;
    createdAt?: string;
}

export interface FundingFacilitiesSummary {
    totalLimit: number;
    totalUsed: number;
    totalAvailable: number;
    overallUtilisationPercent: number;
    facilitiesCount: number;
    activeDrawsCount: number;
    overdueCount: number;
    dueSoonCount: number;
}

export interface FundingDrawRepayment {
    id: string;
    amount: number;
    paymentDate: string;
    reference?: string | null;
    notes?: string | null;
    createdBy?: string | null;
    createdAt: string;
}

export interface FundingDrawHistoryItem {
    id: string;
    field: string;
    oldValue?: string | null;
    newValue?: string | null;
    changedBy: string;
    createdAt: string;
}

export interface FundingDrawRecord {
    id: string;
    facilityId: string;
    facilityKey: string;
    bankName: string;
    productCode: string;
    sanctionedLimit: number;
    roiPercent: number | null;
    graceDays: number | null;
    effectiveGraceDays: number;
    isDefaultGrace: boolean;
    drawDate: string;
    amount: number;
    totalRepaid: number;
    outstanding: number;
    dueDate: string;
    daysLeft: number;
    status: 'OPEN' | 'PARTIAL' | 'REPAID' | 'OVERDUE';
    interestSoFar: number | null;
    reference?: string | null;
    notes?: string | null;
    branch?: { id: string; code: string; name: string } | null;
    createdBy?: string | null;
    repayments?: FundingDrawRepayment[];
    repaymentsCount?: number;
    reminderLevel?: string | null;
    reminderLabel?: string | null;
    history?: FundingDrawHistoryItem[];
    createdAt: string;
    updatedAt?: string;
}

export interface DrawsApiResponse {
    data: FundingDrawRecord[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

const formatINR = (value: number | string | null | undefined) => {
    if (value == null) return '₹0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '₹0';
    return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(num)}`;
};

const formatCurrencyCompact = (value: number) => {
    if (value >= 10000000) {
        return `₹${(value / 10000000).toFixed(2)} Cr`;
    }
    if (value >= 100000) {
        return `₹${(value / 100000).toFixed(2)} L`;
    }
    return formatINR(value);
};

const formatDateDisplay = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'none';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split('-');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[parseInt(m, 10) - 1] || m;
        return `${d.padStart(2, '0')} ${month} ${y}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const formatDateTimeIST = (isoStr: string) => {
    try {
        const d = new Date(isoStr);
        return d.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    } catch {
        return new Date(isoStr).toLocaleString('en-IN');
    }
};

const fieldLabels: Record<string, string> = {
    drawDate: 'Draw date',
    amount: 'Amount',
    reference: 'Reference',
    notes: 'Notes',
    branchId: 'Branch',
};

export function FundingTab() {
    const { user, selectedBranchId } = useAuth();
    const hasCcManage = Boolean(
        user?.roles?.includes('SYSTEM_ADMIN') || user?.permissions?.includes('CC_MANAGE'),
    );

    const [summary, setSummary] = useState<FundingFacilitiesSummary | null>(null);
    const [facilities, setFacilities] = useState<FundingFacilityItem[]>([]);
    const [draws, setDraws] = useState<FundingDrawRecord[]>([]);
    const [totalDraws, setTotalDraws] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Filters
    const [selectedFacilityKey, setSelectedFacilityKey] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // Modals
    const [showNewDrawModal, setShowNewDrawModal] = useState(false);
    const [repayingDraw, setRepayingDraw] = useState<FundingDrawRecord | null>(null);
    const [editingDraw, setEditingDraw] = useState<FundingDrawRecord | null>(null);
    const [isEditModalReadOnly, setIsEditModalReadOnly] = useState(false);

    // Focus draw if URL specifies drawId
    const checkAndFocusDraw = useCallback(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const drawId = params.get('drawId');
            if (drawId) {
                apiRequest<FundingDrawRecord>(`/finance/funding/draws/${encodeURIComponent(drawId)}`)
                    .then((d) => {
                        if (d) {
                            setEditingDraw(d);
                        }
                    })
                    .catch(() => {});
            }
        } catch {}
    }, []);

    useEffect(() => {
        checkAndFocusDraw();
        window.addEventListener('popstate', checkAndFocusDraw);
        window.addEventListener('nexus:navigate-tab', checkAndFocusDraw);
        return () => {
            window.removeEventListener('popstate', checkAndFocusDraw);
            window.removeEventListener('nexus:navigate-tab', checkAndFocusDraw);
        };
    }, [checkAndFocusDraw]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [summaryRes, facilitiesRes, drawsRes] = await Promise.all([
                apiRequest<FundingFacilitiesSummary>('/finance/funding/facilities/summary'),
                apiRequest<FundingFacilityItem[]>('/finance/funding/facilities'),
                apiRequest<DrawsApiResponse>('/finance/funding/draws?limit=200'),
            ]);
            setSummary(summaryRes);
            setFacilities(facilitiesRes || []);
            setDraws(drawsRes.data || []);
            setTotalDraws(drawsRes.total || 0);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load funding facilities data.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData, refreshTrigger]);

    // Filtered draws
    const filteredDraws = useMemo(() => {
        return draws.filter((draw) => {
            if (selectedFacilityKey && selectedFacilityKey !== 'ALL' && draw.facilityKey !== selectedFacilityKey) {
                return false;
            }
            if (statusFilter && statusFilter !== 'ALL' && draw.status !== statusFilter) {
                return false;
            }
            if (selectedBranchId && selectedBranchId !== 'ALL' && draw.branch && draw.branch.id !== selectedBranchId) {
                return false;
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchBank = draw.bankName.toLowerCase().includes(q);
                const matchProduct = draw.productCode.toLowerCase().includes(q);
                const matchRef = (draw.reference || '').toLowerCase().includes(q);
                const matchNotes = (draw.notes || '').toLowerCase().includes(q);
                return matchBank || matchProduct || matchRef || matchNotes;
            }
            return true;
        });
    }, [draws, selectedFacilityKey, statusFilter, selectedBranchId, searchQuery]);

    const handleDataChanged = () => {
        setRefreshTrigger((prev) => prev + 1);
    };

    return (
        <div className="funding-tab-container">
            {/* Top Summary Metrics */}
            {summary && (
                <div className="funding-summary-grid">
                    <div className="funding-metric-card">
                        <span className="metric-label">Total Sanctioned Limit</span>
                        <div className="metric-value">{formatCurrencyCompact(summary.totalLimit)}</div>
                        <span className="metric-subtext">{summary.facilitiesCount} Facilities Active</span>
                    </div>
                    <div className="funding-metric-card">
                        <span className="metric-label">Total Drawn / Used</span>
                        <div className="metric-value metric-used">{formatCurrencyCompact(summary.totalUsed)}</div>
                        <span className="metric-subtext">{summary.activeDrawsCount} Active Draws</span>
                    </div>
                    <div className="funding-metric-card">
                        <span className="metric-label">Total Available</span>
                        <div className="metric-value metric-available">{formatCurrencyCompact(summary.totalAvailable)}</div>
                        <span className="metric-subtext">Across All Banks</span>
                    </div>
                    <div className="funding-metric-card">
                        <span className="metric-label">Overall Utilisation</span>
                        <div className="metric-value">{summary.overallUtilisationPercent}%</div>
                        <div className="funding-progress-bar-bg">
                            <div
                                className={`funding-progress-bar-fill ${
                                    summary.overallUtilisationPercent > 90 ? 'progress-danger' : 'progress-normal'
                                }`}
                                style={{ width: `${Math.min(100, summary.overallUtilisationPercent)}%` }}
                            />
                        </div>
                    </div>
                    <div className={`funding-metric-card ${summary.overdueCount > 0 ? 'metric-card-danger' : ''}`}>
                        <span className="metric-label">Overdue Draws</span>
                        <div className={`metric-value ${summary.overdueCount > 0 ? 'danger-text' : ''}`}>
                            {summary.overdueCount > 0 ? `🚨 ${summary.overdueCount}` : '0'}
                        </div>
                        <span className={`metric-subtext ${summary.overdueCount > 0 ? 'danger-text' : ''}`}>
                            {summary.overdueCount > 0
                                ? `Requires Immediate Attention • ${summary.dueSoonCount} due soon`
                                : `${summary.dueSoonCount} due soon`}
                        </span>
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="funding-error-banner" role="alert">
                    <span>⚠️ {error}</span>
                    <button type="button" onClick={fetchData} className="loan-button-secondary">
                        Retry
                    </button>
                </div>
            )}

            {/* Facilities Cards Grid */}
            <div className="funding-section-header">
                <div>
                    <h2>Credit &amp; Inventory Facilities</h2>
                    <p className="funding-section-subtitle">
                        Bank limits, product codes, ROI % p.a., and grace periods.
                    </p>
                </div>
                {hasCcManage && (
                    <button
                        type="button"
                        className="loan-button-primary"
                        onClick={() => setShowNewDrawModal(true)}
                    >
                        + Record Draw
                    </button>
                )}
            </div>

            <div className="funding-facilities-grid">
                {facilities.map((fac) => (
                    <div
                        key={fac.facilityKey}
                        className={`facility-card ${fac.isOverLimit ? 'facility-overlimit' : ''}`}
                    >
                        <div className="facility-card-header">
                            <div>
                                <span className="facility-bank-name">{fac.bankName}</span>
                                <span className="facility-product-tag">{fac.productCode}</span>
                            </div>
                            <span className="facility-key-label">{fac.facilityKey}</span>
                        </div>

                        <div className="facility-card-metrics">
                            <div className="facility-card-stat">
                                <span className="stat-label">Sanctioned</span>
                                <span className="stat-val">{formatCurrencyCompact(fac.sanctionedLimit)}</span>
                            </div>
                            <div className="facility-card-stat">
                                <span className="stat-label">Used</span>
                                <span className="stat-val text-used">{formatCurrencyCompact(fac.totalUsed)}</span>
                            </div>
                            <div className="facility-card-stat">
                                <span className="stat-label">Available</span>
                                <span className="stat-val text-available">{formatCurrencyCompact(fac.available)}</span>
                            </div>
                        </div>

                        {/* Utilisation Bar */}
                        <div className="facility-bar-container">
                            <div className="facility-bar-info">
                                <span>Utilisation</span>
                                <span className={fac.isOverLimit ? 'danger-text font-bold' : ''}>
                                    {fac.utilisationPercent}% {fac.isOverLimit ? '(Over Limit!)' : ''}
                                </span>
                            </div>
                            <div className="funding-progress-bar-bg">
                                <div
                                    className={`funding-progress-bar-fill ${
                                        fac.isOverLimit
                                            ? 'progress-danger'
                                            : fac.utilisationPercent > 80
                                            ? 'progress-warning'
                                            : 'progress-normal'
                                    }`}
                                    style={{ width: `${Math.min(100, fac.utilisationPercent)}%` }}
                                />
                            </div>
                        </div>

                        {/* Rates and Grace Days */}
                        <div className="facility-card-footer">
                            <div className="footer-item">
                                <span className="footer-label">ROI % p.a.</span>
                                <span className="footer-val">
                                    {fac.roiPercent != null ? `${fac.roiPercent}%` : 'Not set'}
                                </span>
                            </div>
                            <div className="footer-item">
                                <span className="footer-label">Grace Period</span>
                                <span className="footer-val">
                                    {fac.graceDays == null
                                        ? '60 days (default)'
                                        : `${fac.graceDays} days`}
                                </span>
                            </div>
                            <div className="footer-item">
                                <span className="footer-label">Active Draws</span>
                                <span className="footer-val">{fac.activeDrawsCount}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Draws Filter Strip */}
            <div className="funding-draws-section">
                <div className="funding-section-header">
                    <div>
                        <h2>Funding Draws &amp; Repayments</h2>
                        <p className="funding-section-subtitle">
                            Tracking due dates, 10-day reminders, interest so far, and repayment logs.
                        </p>
                    </div>
                </div>

                <div className="funding-filter-strip">
                    <div className="filter-group">
                        <label htmlFor="facilityFilter">Facility:</label>
                        <select
                            id="facilityFilter"
                            value={selectedFacilityKey}
                            onChange={(e) => setSelectedFacilityKey(e.target.value)}
                        >
                            <option value="ALL">All Facilities</option>
                            {facilities.map((f) => (
                                <option key={f.facilityKey} value={f.facilityKey}>
                                    {f.bankName} - {f.productCode} ({f.facilityKey})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="statusFilter">Status:</label>
                        <select
                            id="statusFilter"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="OPEN">Open</option>
                            <option value="PARTIAL">Partial</option>
                            <option value="OVERDUE">Overdue</option>
                            <option value="REPAID">Repaid</option>
                        </select>
                    </div>

                    <div className="filter-group filter-search">
                        <label htmlFor="searchFilter">Search:</label>
                        <input
                            id="searchFilter"
                            type="text"
                            placeholder="Search reference, bank, notes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Draws Table */}
                <div className="funding-table-wrapper">
                    {isLoading ? (
                        <div className="funding-loading">Loading funding draws...</div>
                    ) : filteredDraws.length === 0 ? (
                        <div className="funding-empty-state">
                            No funding draws found matching the selected filters.
                        </div>
                    ) : (
                        <table className="funding-draws-table">
                            <thead>
                                <tr>
                                    <th>Facility</th>
                                    <th>Draw Date</th>
                                    <th>Amount (₹)</th>
                                    <th>Repaid (₹)</th>
                                    <th>Outstanding (₹)</th>
                                    <th>Due Date</th>
                                    <th>Days Left / Alert</th>
                                    <th>Interest so far (approx.)</th>
                                    <th>Reference / Notes</th>
                                    {hasCcManage && <th>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDraws.map((draw) => {
                                    const isOverdue = draw.status === 'OVERDUE';
                                    const isRepaid = draw.status === 'REPAID';

                                    let alertBadgeClass = 'badge-normal';
                                    let alertLabel = `${draw.daysLeft} days left`;
                                    if (isRepaid) {
                                        alertBadgeClass = 'badge-repaid';
                                        alertLabel = 'Fully Repaid';
                                    } else if (draw.daysLeft < 0) {
                                        alertBadgeClass = 'badge-overdue';
                                        alertLabel = `Overdue (${Math.abs(draw.daysLeft)}d)`;
                                    } else if (draw.daysLeft === 0) {
                                        alertBadgeClass = 'badge-due-today';
                                        alertLabel = 'Due today';
                                    } else if (draw.daysLeft === 1) {
                                        alertBadgeClass = 'badge-due-tomorrow';
                                        alertLabel = 'Due tomorrow';
                                    } else if (draw.daysLeft <= 10) {
                                        alertBadgeClass = 'badge-due-10';
                                        alertLabel = `Due in ${draw.daysLeft}d`;
                                    } else if (draw.daysLeft <= 20) {
                                        alertBadgeClass = 'badge-due-20';
                                        alertLabel = `Due in ${draw.daysLeft}d`;
                                    } else if (draw.daysLeft <= 30) {
                                        alertBadgeClass = 'badge-due-30';
                                        alertLabel = `Due in ${draw.daysLeft}d`;
                                    }

                                    return (
                                        <tr key={draw.id} className={isOverdue ? 'row-overdue' : ''}>
                                            <td>
                                                <div className="table-facility-cell">
                                                    <strong>{draw.bankName}</strong>
                                                    <span className="table-product-code">{draw.productCode}</span>
                                                    <small className="table-facility-key">{draw.facilityKey}</small>
                                                </div>
                                            </td>
                                            <td>{formatDateDisplay(draw.drawDate)}</td>
                                            <td className="table-amount font-semibold">{formatINR(draw.amount)}</td>
                                            <td className="table-amount text-muted">{formatINR(draw.totalRepaid)}</td>
                                            <td className={`table-amount font-semibold ${draw.outstanding > 0 ? 'text-outstanding' : 'text-zero'}`}>
                                                {formatINR(draw.outstanding)}
                                            </td>
                                            <td>
                                                <div className="table-due-date">
                                                    <span>{formatDateDisplay(draw.dueDate)}</span>
                                                    <small className="text-muted">
                                                        ({draw.effectiveGraceDays} days)
                                                    </small>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`funding-alert-badge ${alertBadgeClass}`}>
                                                    {alertLabel}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="interest-cell">
                                                    {draw.interestSoFar != null
                                                        ? formatINR(draw.interestSoFar)
                                                        : 'Not set'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="table-notes-cell">
                                                    {draw.reference && <code>{draw.reference}</code>}
                                                    {draw.branch && <span className="branch-tag">{draw.branch.code}</span>}
                                                    {draw.notes && <p className="notes-text">{draw.notes}</p>}
                                                </div>
                                            </td>
                                            {hasCcManage && (
                                                <td>
                                                    <div className="table-actions-cell">
                                                        {draw.outstanding > 0 ? (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    className="btn-repay"
                                                                    onClick={() => setRepayingDraw(draw)}
                                                                >
                                                                    Repay
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="btn-edit"
                                                                    onClick={() => {
                                                                        setIsEditModalReadOnly(false);
                                                                        setEditingDraw(draw);
                                                                    }}
                                                                >
                                                                    Edit
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className="btn-edit"
                                                                onClick={() => {
                                                                    setIsEditModalReadOnly(true);
                                                                    setEditingDraw(draw);
                                                                }}
                                                            >
                                                                View
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                    {totalDraws > draws.length && (
                        <div className="funding-table-footer" style={{ padding: '10px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', color: '#64748b', fontSize: '12px', textAlign: 'right' }}>
                            Showing {draws.length} of {totalDraws} draws
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {showNewDrawModal && (
                <NewDrawModal
                    facilities={facilities}
                    onClose={() => setShowNewDrawModal(false)}
                    onSuccess={() => {
                        setShowNewDrawModal(false);
                        handleDataChanged();
                    }}
                />
            )}

            {repayingDraw && (
                <RecordRepaymentModal
                    draw={repayingDraw}
                    onClose={() => setRepayingDraw(null)}
                    onSuccess={() => {
                        setRepayingDraw(null);
                        handleDataChanged();
                    }}
                />
            )}

            {editingDraw && (
                <EditDrawModal
                    draw={editingDraw}
                    isReadOnly={isEditModalReadOnly}
                    onClose={() => {
                        setEditingDraw(null);
                        setIsEditModalReadOnly(false);
                    }}
                    onSuccess={() => {
                        setEditingDraw(null);
                        setIsEditModalReadOnly(false);
                        handleDataChanged();
                    }}
                />
            )}
        </div>
    );
}

// -------------------------------------------------------------
// New Draw Modal
// -------------------------------------------------------------
interface NewDrawModalProps {
    facilities: FundingFacilityItem[];
    onClose: () => void;
    onSuccess: () => void;
}

function NewDrawModal({ facilities, onClose, onSuccess }: NewDrawModalProps) {
    const activeFacilities = facilities.filter((f) => f.isActive);
    const [facilityId, setFacilityId] = useState(activeFacilities[0]?.id || '');
    const [amount, setAmount] = useState('');
    const [drawDate, setDrawDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const selectedFacility = facilities.find((f) => f.id === facilityId);

    // Over-limit preview warning
    const drawAmountNum = parseFloat(amount) || 0;
    const overLimitWarning = useMemo(() => {
        if (!selectedFacility || drawAmountNum <= 0) return null;
        const newUsed = selectedFacility.totalUsed + drawAmountNum;
        if (newUsed > selectedFacility.sanctionedLimit) {
            const excess = Math.round((newUsed - selectedFacility.sanctionedLimit) * 100) / 100;
            return `Warning: Draw of ₹${drawAmountNum.toLocaleString('en-IN')} exceeds available limit ₹${selectedFacility.available.toLocaleString('en-IN')}. Facility will be over sanctioned limit by ₹${excess.toLocaleString('en-IN')}.`;
        }
        return null;
    }, [selectedFacility, drawAmountNum]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        if (!facilityId) {
            setErrorMessage('Please select a funding facility.');
            return;
        }
        if (drawAmountNum <= 0) {
            setErrorMessage('Draw amount must be greater than 0.');
            return;
        }

        setIsSubmitting(true);
        try {
            await apiRequest('/finance/funding/draws', {
                method: 'POST',
                body: JSON.stringify({
                    facilityId,
                    amount: drawAmountNum,
                    drawDate,
                    reference: reference.trim() || undefined,
                    notes: notes.trim() || undefined,
                }),
            });
            onSuccess();
        } catch (err: unknown) {
            if (err instanceof ApiError) {
                setErrorMessage(err.message);
            } else if (err instanceof Error) {
                setErrorMessage(err.message);
            } else {
                setErrorMessage('Failed to create funding draw.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="funding-modal-backdrop" onClick={onClose}>
            <div className="funding-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="funding-modal-header">
                    <h3>Record New Funding Draw</h3>
                    <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
                        &times;
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="funding-modal-body">
                        {errorMessage && (
                            <div className="funding-modal-error" role="alert">
                                ⚠️ {errorMessage}
                            </div>
                        )}

                        <div className="funding-form-group">
                            <label htmlFor="drawFacility">Funding Facility *</label>
                            <select
                                id="drawFacility"
                                value={facilityId}
                                onChange={(e) => setFacilityId(e.target.value)}
                                required
                            >
                                {activeFacilities.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        {f.bankName} - {f.productCode} (Avail: ₹{Math.round(f.available).toLocaleString('en-IN')})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedFacility && (
                            <div className="facility-quick-info">
                                <span>Limit: ₹{selectedFacility.sanctionedLimit.toLocaleString('en-IN')}</span>
                                <span>Available: ₹{selectedFacility.available.toLocaleString('en-IN')}</span>
                                <span>
                                    Grace: {selectedFacility.graceDays == null ? '60 days (default)' : `${selectedFacility.graceDays} days`}
                                </span>
                            </div>
                        )}

                        <div className="funding-form-group">
                            <label htmlFor="drawAmount">Draw Amount (₹) *</label>
                            <input
                                id="drawAmount"
                                type="number"
                                min="1"
                                step="any"
                                placeholder="e.g. 5000000"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                required
                            />
                        </div>

                        {overLimitWarning && (
                            <div className="funding-modal-warning">
                                ⚠️ {overLimitWarning}
                            </div>
                        )}

                        <div className="funding-form-group">
                            <label htmlFor="drawDate">Draw Date *</label>
                            <input
                                id="drawDate"
                                type="date"
                                value={drawDate}
                                onChange={(e) => setDrawDate(e.target.value)}
                                required
                            />
                        </div>

                        <div className="funding-form-group">
                            <label htmlFor="drawReference">Reference / UTR / Sanction Ref</label>
                            <input
                                id="drawReference"
                                type="text"
                                placeholder="e.g. DRAW/2026/089"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                            />
                        </div>

                        <div className="funding-form-group">
                            <label htmlFor="drawNotes">Notes</label>
                            <textarea
                                id="drawNotes"
                                rows={2}
                                placeholder="e.g. Draw for festive inventory stocking"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="funding-modal-footer">
                        <button type="button" className="loan-button-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="loan-button-primary"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Recording Draw...' : 'Record Draw'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// -------------------------------------------------------------
// Record Repayment Modal
// -------------------------------------------------------------
interface RecordRepaymentModalProps {
    draw: FundingDrawRecord;
    onClose: () => void;
    onSuccess: () => void;
}

function RecordRepaymentModal({ draw, onClose, onSuccess }: RecordRepaymentModalProps) {
    const [amount, setAmount] = useState(String(draw.outstanding));
    const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        const repayNum = parseFloat(amount) || 0;
        if (repayNum <= 0) {
            setErrorMessage('Repayment amount must be greater than 0.');
            return;
        }

        // User Rule 7: reject if repayment > outstanding
        if (repayNum > draw.outstanding) {
            setErrorMessage(
                `Repayment ₹${repayNum.toLocaleString('en-IN')} is more than outstanding ₹${draw.outstanding.toLocaleString('en-IN')}.`,
            );
            return;
        }

        setIsSubmitting(true);
        try {
            await apiRequest(`/finance/funding/draws/${draw.id}/repayments`, {
                method: 'POST',
                body: JSON.stringify({
                    amount: repayNum,
                    paymentDate,
                    reference: reference.trim() || undefined,
                    notes: notes.trim() || undefined,
                }),
            });
            onSuccess();
        } catch (err: unknown) {
            if (err instanceof ApiError) {
                setErrorMessage(err.message);
            } else if (err instanceof Error) {
                setErrorMessage(err.message);
            } else {
                setErrorMessage('Failed to record repayment.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="funding-modal-backdrop" onClick={onClose}>
            <div className="funding-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="funding-modal-header">
                    <h3>Record Facility Repayment</h3>
                    <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
                        &times;
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="funding-modal-body">
                        {errorMessage && (
                            <div className="funding-modal-error" role="alert">
                                ⚠️ {errorMessage}
                            </div>
                        )}

                        <div className="repay-draw-summary">
                            <div><strong>Facility:</strong> {draw.bankName} - {draw.productCode}</div>
                            <div><strong>Draw Date:</strong> {draw.drawDate}</div>
                            <div><strong>Original Draw:</strong> ₹{draw.amount.toLocaleString('en-IN')}</div>
                            <div>
                                <strong>Outstanding Balance:</strong>{' '}
                                <span className="text-outstanding font-bold">
                                    ₹{draw.outstanding.toLocaleString('en-IN')}
                                </span>
                            </div>
                        </div>

                        <div className="funding-form-group">
                            <label htmlFor="repayAmount">Repayment Amount (₹) *</label>
                            <input
                                id="repayAmount"
                                type="number"
                                min="1"
                                max={draw.outstanding}
                                step="any"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                required
                            />
                            <small className="form-help">Max allowed: ₹{draw.outstanding.toLocaleString('en-IN')}</small>
                        </div>

                        <div className="funding-form-group">
                            <label htmlFor="repayDate">Payment Date *</label>
                            <input
                                id="repayDate"
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                required
                            />
                        </div>

                        <div className="funding-form-group">
                            <label htmlFor="repayRef">Bank UTR / Cheque / Reference</label>
                            <input
                                id="repayRef"
                                type="text"
                                placeholder="e.g. UTR123456789"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                            />
                        </div>

                        <div className="funding-form-group">
                            <label htmlFor="repayNotes">Notes</label>
                            <textarea
                                id="repayNotes"
                                rows={2}
                                placeholder="e.g. RTGS payment from operating account"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="funding-modal-footer">
                        <button type="button" className="loan-button-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="loan-button-primary"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Recording Repayment...' : 'Confirm Repayment'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// -------------------------------------------------------------
// Edit / View Draw Modal with Audit Trail & Repayments
// -------------------------------------------------------------
interface EditDrawModalProps {
    draw: FundingDrawRecord;
    isReadOnly?: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

function EditDrawModal({ draw, isReadOnly = false, onClose, onSuccess }: EditDrawModalProps) {
    const [amount, setAmount] = useState(String(draw.amount));
    const [drawDate, setDrawDate] = useState(draw.drawDate);
    const [reference, setReference] = useState(draw.reference || '');
    const [notes, setNotes] = useState(draw.notes || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [history, setHistory] = useState<FundingDrawHistoryItem[]>(draw.history || []);
    const [repayments, setRepayments] = useState<FundingDrawRepayment[]>(draw.repayments || []);
    const [isLoadingDetails, setIsLoadingDetails] = useState(true);
    const [detailsError, setDetailsError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        setIsLoadingDetails(true);
        setDetailsError(null);
        apiRequest<FundingDrawRecord>(`/finance/funding/draws/${draw.id}`)
            .then((fullDraw) => {
                if (isMounted) {
                    setHistory(fullDraw.history || []);
                    setRepayments(fullDraw.repayments || []);
                }
            })
            .catch(() => {
                if (isMounted) {
                    setDetailsError("Couldn't load history");
                }
            })
            .finally(() => {
                if (isMounted) {
                    setIsLoadingDetails(false);
                }
            });
        return () => {
            isMounted = false;
        };
    }, [draw.id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly) return;
        setErrorMessage(null);

        const amtNum = parseFloat(amount) || 0;
        if (amtNum <= 0) {
            setErrorMessage('Draw amount must be greater than 0.');
            return;
        }
        if (amtNum < draw.totalRepaid) {
            setErrorMessage(
                `Draw amount cannot be less than already repaid amount ₹${draw.totalRepaid.toLocaleString('en-IN')}.`,
            );
            return;
        }

        setIsSubmitting(true);
        try {
            await apiRequest(`/finance/funding/draws/${draw.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    amount: amtNum,
                    drawDate,
                    reference: reference.trim() || undefined,
                    notes: notes.trim() || undefined,
                }),
            });
            onSuccess();
        } catch (err: unknown) {
            if (err instanceof ApiError) {
                setErrorMessage(err.message);
            } else if (err instanceof Error) {
                setErrorMessage(err.message);
            } else {
                setErrorMessage('Failed to update funding draw.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalRepaymentsSum = useMemo(() => {
        return repayments.reduce((sum, r) => sum + r.amount, 0);
    }, [repayments]);

    return (
        <div className="funding-modal-backdrop" onClick={onClose}>
            <div className="funding-modal-card funding-modal-large" onClick={(e) => e.stopPropagation()}>
                <div className="funding-modal-header">
                    <h3>{isReadOnly ? 'View' : 'Edit'} Funding Draw ({draw.facilityKey})</h3>
                    <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
                        &times;
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="funding-modal-body">
                        {errorMessage && (
                            <div className="funding-modal-error" role="alert">
                                ⚠️ {errorMessage}
                            </div>
                        )}

                        <div className="funding-form-group">
                            <label htmlFor="editAmount">Draw Amount (₹) *</label>
                            <input
                                id="editAmount"
                                type="number"
                                min={draw.totalRepaid || 1}
                                step="any"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                disabled={isReadOnly}
                                required
                            />
                            {draw.totalRepaid > 0 && (
                                <small className="form-help">Already repaid: ₹{draw.totalRepaid.toLocaleString('en-IN')}</small>
                            )}
                        </div>

                        <div className="funding-form-group">
                            <label htmlFor="editDate">Draw Date *</label>
                            <input
                                id="editDate"
                                type="date"
                                value={drawDate}
                                onChange={(e) => setDrawDate(e.target.value)}
                                disabled={isReadOnly}
                                required
                            />
                        </div>

                        <div className="funding-form-group">
                            <label htmlFor="editRef">Reference</label>
                            <input
                                id="editRef"
                                type="text"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                disabled={isReadOnly}
                            />
                        </div>

                        <div className="funding-form-group">
                            <label htmlFor="editNotes">Notes</label>
                            <textarea
                                id="editNotes"
                                rows={2}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                disabled={isReadOnly}
                            />
                        </div>

                        {/* Repayments History */}
                        <div className="funding-history-section">
                            <h4>Repayments</h4>
                            {isLoadingDetails ? (
                                <p className="text-muted">Loading…</p>
                            ) : detailsError ? (
                                <p className="text-muted danger-text">{detailsError}</p>
                            ) : repayments && repayments.length > 0 ? (
                                <div style={{ overflowX: 'auto', marginBottom: '8px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                                                <th style={{ padding: '6px 8px' }}>Date</th>
                                                <th style={{ padding: '6px 8px' }}>Amount</th>
                                                <th style={{ padding: '6px 8px' }}>Reference</th>
                                                <th style={{ padding: '6px 8px' }}>Recorded By</th>
                                                <th style={{ padding: '6px 8px' }}>Recorded At</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {repayments.map((r) => (
                                                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '6px 8px' }}>{formatDateDisplay(r.paymentDate)}</td>
                                                    <td style={{ padding: '6px 8px', fontWeight: 600 }}>{formatINR(r.amount)}</td>
                                                    <td style={{ padding: '6px 8px' }}>
                                                        {r.reference ? <code>{r.reference}</code> : <span className="text-muted">—</span>}
                                                    </td>
                                                    <td style={{ padding: '6px 8px' }}>{r.createdBy || <span className="text-muted">—</span>}</td>
                                                    <td style={{ padding: '6px 8px', color: '#64748b' }}>{formatDateTimeIST(r.createdAt)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                                                <td style={{ padding: '6px 8px', fontWeight: 700 }}>Total Repaid</td>
                                                <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0f172a' }}>
                                                    {formatINR(totalRepaymentsSum)}
                                                </td>
                                                <td colSpan={3}></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-muted">No repayments yet</p>
                            )}
                        </div>

                        {/* Audit Trail History */}
                        <div className="funding-history-section">
                            <h4>Audit History</h4>
                            {isLoadingDetails ? (
                                <p className="text-muted">Loading…</p>
                            ) : detailsError ? (
                                <p className="text-muted danger-text">{detailsError}</p>
                            ) : history && history.length > 0 ? (
                                <ul className="funding-history-list">
                                    {history.map((h) => {
                                        const label = fieldLabels[h.field] || h.field;
                                        let oldVal = h.oldValue || 'none';
                                        let newVal = h.newValue || 'none';
                                        if (h.field === 'drawDate') {
                                            oldVal = formatDateDisplay(h.oldValue);
                                            newVal = formatDateDisplay(h.newValue);
                                        } else if (h.field === 'amount') {
                                            oldVal = formatINR(h.oldValue);
                                            newVal = formatINR(h.newValue);
                                        }
                                        return (
                                            <li key={h.id}>
                                                <strong>{label}:</strong> Changed from{' '}
                                                <code>{oldVal}</code> to{' '}
                                                <code>{newVal}</code> by {h.changedBy} on{' '}
                                                {formatDateTimeIST(h.createdAt)}
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <p className="text-muted">No edits recorded for this draw.</p>
                            )}
                        </div>
                    </div>

                    <div className="funding-modal-footer">
                        <button type="button" className="loan-button-secondary" onClick={onClose}>
                            {isReadOnly ? 'Close' : 'Cancel'}
                        </button>
                        {!isReadOnly && (
                            <button
                                type="submit"
                                className="loan-button-primary"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Saving...' : 'Save Changes'}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
