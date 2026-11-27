import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFundingDrawDto } from './dto/create-funding-draw.dto';
import { UpdateFundingDrawDto } from './dto/update-funding-draw.dto';
import { CreateFundingRepaymentDto } from './dto/create-funding-repayment.dto';
import { FundingQueryDto } from './dto/funding-query.dto';
import {
    calculateFundingDueDate,
    calculateDrawOutstanding,
    calculateFacilityMetrics,
    calculateInterestSoFar,
    getFundingDrawStatus,
    getFundingReminder,
    getTodayIST,
    toCalendarDateIST,
    differenceInCalendarDays,
    FundingReminderAlert,
    DEFAULT_GRACE_DAYS,
} from './funding-calculator';

export interface AuthenticatedUser {
    userId: string;
    email: string;
    roles?: string[];
    permissions?: string[];
    branchIds?: string[];
}

@Injectable()
export class FinanceFundingService {
    constructor(private readonly prisma: PrismaService) {}

    private isAdmin(user: AuthenticatedUser): boolean {
        return Boolean(user?.roles?.includes('SYSTEM_ADMIN'));
    }

    /**
     * Helper to verify CC_VIEW permission.
     * SYSTEM_ADMIN bypasses this check.
     */
    verifyCcViewAccess(user: AuthenticatedUser) {
        if (this.isAdmin(user)) return;
        const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
        if (!permissions.includes('CC_VIEW')) {
            throw new ForbiddenException(
                'Access denied: You require the CC_VIEW permission to view CC and inventory funding data.',
            );
        }
    }

    /**
     * Helper to verify CC_MANAGE permission.
     * SYSTEM_ADMIN bypasses this check.
     */
    verifyCcManageAccess(user: AuthenticatedUser) {
        if (this.isAdmin(user)) return;
        const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
        if (!permissions.includes('CC_MANAGE')) {
            throw new ForbiddenException(
                'Access denied: You require the CC_MANAGE permission to perform this action.',
            );
        }
    }

    /**
     * Lists all funding facilities with their live utilised balance and availability.
     */
    async getFacilities() {
        const facilities = await this.prisma.fundingFacility.findMany({
            include: {
                lender: { select: { id: true, name: true, tallyLedgerName: true } },
                draws: {
                    select: {
                        amount: true,
                        repayments: { select: { amount: true } },
                    },
                },
            },
            orderBy: [{ bankName: 'asc' }, { productCode: 'asc' }],
        });

        return facilities.map((fac) => {
            const limit = Number(fac.sanctionedLimit);
            let totalUsed = 0;
            let activeDrawsCount = 0;

            for (const draw of fac.draws) {
                const { outstanding } = calculateDrawOutstanding(
                    Number(draw.amount),
                    draw.repayments.map((r) => ({ amount: Number(r.amount) })),
                );
                if (outstanding > 0) {
                    totalUsed += outstanding;
                    activeDrawsCount++;
                }
            }

            const metrics = calculateFacilityMetrics(limit, totalUsed);
            const effectiveGraceDays = fac.graceDays ?? DEFAULT_GRACE_DAYS;
            const isDefaultGrace = fac.graceDays == null;

            return {
                id: fac.id,
                facilityKey: fac.facilityKey,
                bankName: fac.bankName,
                productCode: fac.productCode,
                facilityType: fac.facilityType,
                sanctionedLimit: limit,
                roiPercent: fac.roiPercent != null ? Number(fac.roiPercent) : null,
                graceDays: fac.graceDays,
                effectiveGraceDays,
                isDefaultGrace,
                isActive: fac.isActive,
                lenderId: fac.lenderId,
                lenderName: fac.lender?.name || null,
                totalUsed: metrics.totalUsed,
                available: metrics.available,
                utilisationPercent: metrics.utilisationPercent,
                isOverLimit: metrics.isOverLimit,
                activeDrawsCount,
                createdAt: fac.createdAt,
            };
        });
    }

    /**
     * Aggregate metrics across active facilities for the summary banner cards.
     */
    async getSummary() {
        const facilities = await this.getFacilities();
        const activeFacilities = facilities.filter((f) => f.isActive);

        const totalLimit = activeFacilities.reduce((sum, f) => sum + f.sanctionedLimit, 0);
        const totalUsed = activeFacilities.reduce((sum, f) => sum + f.totalUsed, 0);
        const totalAvailable = Math.round((totalLimit - totalUsed) * 100) / 100;
        const overallUtilisationPercent =
            totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0;
        const activeDrawsCount = activeFacilities.reduce((sum, f) => sum + f.activeDrawsCount, 0);

        // Fetch overdue and due soon draws count
        const alertsData = await this.getAlerts();

        return {
            totalLimit,
            totalUsed,
            totalAvailable,
            overallUtilisationPercent,
            facilitiesCount: activeFacilities.length,
            activeDrawsCount,
            overdueCount: alertsData.summary.overdueCount,
            dueSoonCount: alertsData.summary.dueSoonCount,
        };
    }

    /**
     * Queries and paginates funding draws with calculated due dates, balances, and interest.
     */
    async getDraws(query: FundingQueryDto) {
        const today = getTodayIST();
        const where: any = {};

        const facilityId = query.facilityId?.trim();
        if (facilityId && facilityId.toUpperCase() !== 'ALL') {
            where.facilityId = facilityId;
        }

        const fromDate = query.fromDate?.trim();
        const toDate = query.toDate?.trim();
        if (fromDate || toDate) {
            where.drawDate = {};
            if (fromDate) where.drawDate.gte = new Date(fromDate);
            if (toDate) where.drawDate.lte = new Date(toDate);
        }

        const draws = await this.prisma.fundingDraw.findMany({
            where,
            include: {
                facility: {
                    select: {
                        id: true,
                        facilityKey: true,
                        bankName: true,
                        productCode: true,
                        sanctionedLimit: true,
                        roiPercent: true,
                        graceDays: true,
                    },
                },
                branch: { select: { id: true, code: true, name: true } },
                createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
                repayments: {
                    select: { id: true, amount: true, paymentDate: true, reference: true },
                    orderBy: { paymentDate: 'desc' },
                },
            },
            orderBy: { drawDate: 'desc' },
        });

        // Compute live values for each draw
        let computedDraws = draws.map((draw) => {
            const amount = Number(draw.amount);
            const repaymentsList = draw.repayments.map((r) => ({ amount: Number(r.amount) }));
            const { totalRepaid, outstanding } = calculateDrawOutstanding(amount, repaymentsList);
            const { dueDate, effectiveGraceDays, isDefault } = calculateFundingDueDate(
                draw.drawDate,
                draw.facility.graceDays,
            );
            const daysLeft = differenceInCalendarDays(dueDate, today);
            const roi = draw.facility.roiPercent != null ? Number(draw.facility.roiPercent) : null;
            const interestSoFar = calculateInterestSoFar(outstanding, roi, draw.drawDate, today);
            const status = getFundingDrawStatus(amount, totalRepaid, dueDate, today);
            const reminder = getFundingReminder(
                {
                    id: draw.id,
                    facilityId: draw.facilityId,
                    amount,
                    drawDate: draw.drawDate,
                    facility: draw.facility,
                    repayments: repaymentsList,
                },
                today,
            );

            return {
                id: draw.id,
                facilityId: draw.facilityId,
                facilityKey: draw.facility.facilityKey,
                bankName: draw.facility.bankName,
                productCode: draw.facility.productCode,
                sanctionedLimit: Number(draw.facility.sanctionedLimit),
                roiPercent: roi,
                graceDays: draw.facility.graceDays,
                effectiveGraceDays,
                isDefaultGrace: isDefault,
                drawDate: toCalendarDateIST(draw.drawDate),
                amount,
                totalRepaid,
                outstanding,
                dueDate,
                daysLeft,
                status,
                interestSoFar,
                reminderLevel: reminder?.level || null,
                reminderLabel: reminder?.levelLabel || null,
                reference: draw.reference,
                notes: draw.notes,
                branch: draw.branch ? { id: draw.branch.id, code: draw.branch.code, name: draw.branch.name } : null,
                createdBy: draw.createdBy ? `${draw.createdBy.firstName} ${draw.createdBy.lastName}` : null,
                repaymentsCount: draw.repayments.length,
                createdAt: draw.createdAt,
            };
        });

        // Search filter (text search on bank, code, reference, notes)
        if (query.search && query.search.trim()) {
            const term = query.search.trim().toLowerCase();
            computedDraws = computedDraws.filter(
                (d) =>
                    d.bankName.toLowerCase().includes(term) ||
                    d.productCode.toLowerCase().includes(term) ||
                    (d.reference && d.reference.toLowerCase().includes(term)) ||
                    (d.notes && d.notes.toLowerCase().includes(term)),
            );
        }

        // Status filter
        const status = query.status?.trim();
        if (status && status.toUpperCase() !== 'ALL') {
            computedDraws = computedDraws.filter(
                (d) => d.status.toUpperCase() === status.toUpperCase(),
            );
        }

        // Overdue only filter
        if (query.overdueOnly === 'true' || query.overdueOnly === '1') {
            computedDraws = computedDraws.filter((d) => d.status === 'OVERDUE');
        }

        // Pagination
        const total = computedDraws.length;
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.max(1, Math.min(200, Number(query.limit) || 25));
        const totalPages = Math.ceil(total / limit) || 1;
        const offset = (page - 1) * limit;
        const paginatedData = computedDraws.slice(offset, offset + limit);

        return {
            data: paginatedData,
            total,
            page,
            limit,
            totalPages,
        };
    }

    /**
     * Retrieves single draw with full repayments and audit history.
     */
    async getDrawById(id: string) {
        const today = getTodayIST();
        const draw = await this.prisma.fundingDraw.findUnique({
            where: { id },
            include: {
                facility: true,
                branch: true,
                createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
                repayments: {
                    include: {
                        createdBy: { select: { id: true, firstName: true, lastName: true } },
                    },
                    orderBy: { paymentDate: 'desc' },
                },
                history: {
                    include: {
                        user: { select: { id: true, firstName: true, lastName: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!draw) {
            throw new NotFoundException(`Funding draw with ID "${id}" not found.`);
        }

        const amount = Number(draw.amount);
        const repaymentsList = draw.repayments.map((r) => ({ amount: Number(r.amount) }));
        const { totalRepaid, outstanding } = calculateDrawOutstanding(amount, repaymentsList);
        const { dueDate, effectiveGraceDays, isDefault } = calculateFundingDueDate(
            draw.drawDate,
            draw.facility.graceDays,
        );
        const daysLeft = differenceInCalendarDays(dueDate, today);
        const roi = draw.facility.roiPercent != null ? Number(draw.facility.roiPercent) : null;
        const interestSoFar = calculateInterestSoFar(outstanding, roi, draw.drawDate, today);
        const status = getFundingDrawStatus(amount, totalRepaid, dueDate, today);

        return {
            id: draw.id,
            facilityId: draw.facilityId,
            facilityKey: draw.facility.facilityKey,
            bankName: draw.facility.bankName,
            productCode: draw.facility.productCode,
            sanctionedLimit: Number(draw.facility.sanctionedLimit),
            roiPercent: roi,
            graceDays: draw.facility.graceDays,
            effectiveGraceDays,
            isDefaultGrace: isDefault,
            drawDate: toCalendarDateIST(draw.drawDate),
            amount,
            totalRepaid,
            outstanding,
            dueDate,
            daysLeft,
            status,
            interestSoFar,
            reference: draw.reference,
            notes: draw.notes,
            branch: draw.branch ? { id: draw.branch.id, code: draw.branch.code, name: draw.branch.name } : null,
            createdBy: draw.createdBy ? `${draw.createdBy.firstName} ${draw.createdBy.lastName}` : null,
            repayments: draw.repayments.map((r) => ({
                id: r.id,
                amount: Number(r.amount),
                paymentDate: toCalendarDateIST(r.paymentDate),
                reference: r.reference,
                notes: r.notes,
                createdBy: r.createdBy ? `${r.createdBy.firstName} ${r.createdBy.lastName}` : null,
                createdAt: r.createdAt,
            })),
            history: draw.history.map((h) => ({
                id: h.id,
                field: h.field,
                oldValue: h.oldValue,
                newValue: h.newValue,
                changedBy: h.user ? `${h.user.firstName} ${h.user.lastName}` : 'System',
                createdAt: h.createdAt,
            })),
            createdAt: draw.createdAt,
            updatedAt: draw.updatedAt,
        };
    }

    /**
     * Creates a new funding draw. Warns if it exceeds the sanctioned limit.
     */
    async createDraw(user: AuthenticatedUser, dto: CreateFundingDrawDto) {
        const facility = await this.prisma.fundingFacility.findUnique({
            where: { id: dto.facilityId },
            include: {
                draws: {
                    select: {
                        amount: true,
                        repayments: { select: { amount: true } },
                    },
                },
            },
        });

        if (!facility) {
            throw new NotFoundException(`Funding facility with ID "${dto.facilityId}" not found.`);
        }
        if (!facility.isActive) {
            throw new BadRequestException(`Funding facility "${facility.bankName} - ${facility.productCode}" is inactive.`);
        }

        const amount = Number(dto.amount);
        if (amount <= 0) {
            throw new BadRequestException('Draw amount must be greater than 0.');
        }

        // Validate branch if provided
        if (dto.branchId) {
            const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
            if (!branch) {
                throw new NotFoundException(`Branch with ID "${dto.branchId}" not found.`);
            }
        }

        // Calculate current usage
        let currentUsed = 0;
        for (const d of facility.draws) {
            const { outstanding } = calculateDrawOutstanding(
                Number(d.amount),
                d.repayments.map((r) => ({ amount: Number(r.amount) })),
            );
            currentUsed += outstanding;
        }

        const sanctionedLimit = Number(facility.sanctionedLimit);
        const newUsed = currentUsed + amount;
        let warning: string | null = null;
        if (newUsed > sanctionedLimit) {
            const excess = Math.round((newUsed - sanctionedLimit) * 100) / 100;
            warning = `Draw of ₹${amount.toLocaleString('en-IN')} takes facility over sanctioned limit by ₹${excess.toLocaleString('en-IN')}.`;
        }

        const created = await this.prisma.fundingDraw.create({
            data: {
                facilityId: facility.id,
                drawDate: new Date(dto.drawDate),
                amount,
                reference: dto.reference?.trim() || null,
                notes: dto.notes?.trim() || null,
                branchId: dto.branchId || null,
                createdById: user.userId,
            },
        });

        return {
            draw: created,
            warning,
        };
    }

    /**
     * Updates draw details and records audit history.
     */
    async updateDraw(user: AuthenticatedUser, id: string, dto: UpdateFundingDrawDto) {
        const existing = await this.prisma.fundingDraw.findUnique({
            where: { id },
        });

        if (!existing) {
            throw new NotFoundException(`Funding draw with ID "${id}" not found.`);
        }

        const updates: any = {};
        const historyEntries: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];

        if (dto.amount !== undefined) {
            const newAmount = Number(dto.amount);
            if (newAmount <= 0) {
                throw new BadRequestException('Draw amount must be greater than 0.');
            }
            if (newAmount !== Number(existing.amount)) {
                historyEntries.push({
                    field: 'amount',
                    oldValue: String(existing.amount),
                    newValue: String(newAmount),
                });
                updates.amount = newAmount;
            }
        }

        if (dto.drawDate) {
            const oldDateStr = toCalendarDateIST(existing.drawDate);
            const newDateStr = toCalendarDateIST(dto.drawDate);
            if (oldDateStr !== newDateStr) {
                historyEntries.push({
                    field: 'drawDate',
                    oldValue: oldDateStr,
                    newValue: newDateStr,
                });
                updates.drawDate = new Date(dto.drawDate);
            }
        }

        if (dto.reference !== undefined) {
            const newRef = dto.reference ? dto.reference.trim() : null;
            if (newRef !== existing.reference) {
                historyEntries.push({
                    field: 'reference',
                    oldValue: existing.reference,
                    newValue: newRef,
                });
                updates.reference = newRef;
            }
        }

        if (dto.notes !== undefined) {
            const newNotes = dto.notes ? dto.notes.trim() : null;
            if (newNotes !== existing.notes) {
                historyEntries.push({
                    field: 'notes',
                    oldValue: existing.notes,
                    newValue: newNotes,
                });
                updates.notes = newNotes;
            }
        }

        if (dto.branchId !== undefined) {
            const newBranchId = dto.branchId || null;
            if (newBranchId !== existing.branchId) {
                historyEntries.push({
                    field: 'branchId',
                    oldValue: existing.branchId,
                    newValue: newBranchId,
                });
                updates.branchId = newBranchId;
            }
        }

        if (Object.keys(updates).length === 0) {
            return this.getDrawById(id);
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.fundingDraw.update({
                where: { id },
                data: updates,
            });

            for (const h of historyEntries) {
                await tx.fundingDrawHistory.create({
                    data: {
                        drawId: id,
                        userId: user.userId,
                        field: h.field,
                        oldValue: h.oldValue,
                        newValue: h.newValue,
                    },
                });
            }
        });

        return this.getDrawById(id);
    }

    /**
     * Records a repayment for a draw.
     * Enforces User Condition 7: Repayment greater than outstanding is rejected with
     * "Repayment ₹X is more than outstanding ₹Y".
     */
    async recordRepayment(user: AuthenticatedUser, drawId: string, dto: CreateFundingRepaymentDto) {
        const draw = await this.prisma.fundingDraw.findUnique({
            where: { id: drawId },
            include: {
                repayments: { select: { amount: true } },
            },
        });

        if (!draw) {
            throw new NotFoundException(`Funding draw with ID "${drawId}" not found.`);
        }

        const repaymentAmount = Number(dto.amount);
        if (repaymentAmount <= 0) {
            throw new BadRequestException('Repayment amount must be greater than 0.');
        }

        const drawAmount = Number(draw.amount);
        const { outstanding } = calculateDrawOutstanding(
            drawAmount,
            draw.repayments.map((r) => ({ amount: Number(r.amount) })),
        );

        if (repaymentAmount > outstanding) {
            throw new BadRequestException(
                `Repayment ₹${repaymentAmount.toLocaleString('en-IN')} is more than outstanding ₹${outstanding.toLocaleString('en-IN')}.`,
            );
        }

        const repayment = await this.prisma.fundingRepayment.create({
            data: {
                drawId,
                amount: repaymentAmount,
                paymentDate: new Date(dto.paymentDate),
                reference: dto.reference?.trim() || null,
                notes: dto.notes?.trim() || null,
                createdById: user.userId,
            },
        });

        return repayment;
    }

    /**
     * Computes all active funding reminder alerts on read.
     * Evaluated against reminder levels (Overdue, Due today, Due tomorrow, Due within 10/20/30 days).
     */
    async getAlerts(): Promise<{
        alerts: FundingReminderAlert[];
        summary: {
            totalAlerts: number;
            overdueCount: number;
            dueSoonCount: number;
        };
    }> {
        const today = getTodayIST();
        const activeDraws = await this.prisma.fundingDraw.findMany({
            include: {
                facility: {
                    select: {
                        facilityKey: true,
                        bankName: true,
                        productCode: true,
                        graceDays: true,
                    },
                },
                repayments: { select: { amount: true } },
            },
        });

        const alerts: FundingReminderAlert[] = [];
        let overdueCount = 0;
        let dueSoonCount = 0;

        for (const draw of activeDraws) {
            const reminder = getFundingReminder(
                {
                    id: draw.id,
                    facilityId: draw.facilityId,
                    amount: Number(draw.amount),
                    drawDate: draw.drawDate,
                    facility: draw.facility,
                    repayments: draw.repayments.map((r) => ({ amount: Number(r.amount) })),
                },
                today,
            );

            if (reminder) {
                alerts.push(reminder);
                if (reminder.isOverdue) {
                    overdueCount++;
                } else if (reminder.daysLeft <= 10) {
                    dueSoonCount++;
                }
            }
        }

        // Sort: Overdue first (most overdue first), then upcoming (least days left first)
        alerts.sort((a, b) => a.daysLeft - b.daysLeft);

        return {
            alerts,
            summary: {
                totalAlerts: alerts.length,
                overdueCount,
                dueSoonCount,
            },
        };
    }
}
