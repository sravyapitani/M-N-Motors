
import {
    Injectable,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExchangeVehiclesInspectionService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }


    validateInspectionInput(body: {
        condition?: string;
        notes?: string;
        inspectionScore?: number;
        accidentHistory?: boolean | null;
        accidentSeverity?: 'MINOR' | 'MODERATE' | 'MAJOR' | null;
        repaintHistory?: boolean | null;
        repaintCoverage?: 'ONE_TO_TWO_PANELS' | 'THREE_TO_FIVE_PANELS' | 'FULL_BODY' | null;
        fullServiceHistory?: boolean | null;
    }) {
        const allowedConditions = [
            'EXCELLENT',
            'GOOD',
            'FAIR',
            'POOR',
            'VERY_POOR',
        ];

        if (
            typeof body.condition !== 'string' ||
            !allowedConditions.includes(body.condition.toUpperCase())
        ) {
            throw new BadRequestException(
                'Condition must be EXCELLENT, GOOD, FAIR, POOR, or VERY_POOR',
            );
        }

        if (
            body.notes !== undefined &&
            typeof body.notes !== 'string'
        ) {
            throw new BadRequestException('Inspection notes must be text');
        }

        if (
            body.inspectionScore !== undefined &&
            (
                !Number.isInteger(body.inspectionScore) ||
                body.inspectionScore < 0 ||
                body.inspectionScore > 100
            )
        ) {
            throw new BadRequestException(
                'Inspection score must be an integer between 0 and 100',
            );
        }

        // Allow true, false, and null (not verified).
        for (const field of [
            'accidentHistory',
            'repaintHistory',
            'fullServiceHistory',
        ] as const) {
            if (
                body[field] !== undefined &&
                body[field] !== null &&
                typeof body[field] !== 'boolean'
            ) {
                throw new BadRequestException(
                    `${field} must be true, false, or null`,
                );
            }
        }

        const allowedAccidentSeverities = [
            'MINOR',
            'MODERATE',
            'MAJOR',
        ];

        if (
            body.accidentSeverity != null &&
            !allowedAccidentSeverities.includes(body.accidentSeverity)
        ) {
            throw new BadRequestException(
                'Accident severity must be MINOR, MODERATE, or MAJOR',
            );
        }

        const allowedRepaintCoverages = [
            'ONE_TO_TWO_PANELS',
            'THREE_TO_FIVE_PANELS',
            'FULL_BODY',
        ];

        if (
            body.repaintCoverage != null &&
            !allowedRepaintCoverages.includes(body.repaintCoverage)
        ) {
            throw new BadRequestException(
                'Repaint coverage must be ONE_TO_TWO_PANELS, THREE_TO_FIVE_PANELS, or FULL_BODY',
            );
        }

        // Accident severity is required only when accident history is Yes.
        if (
            body.accidentHistory === true &&
            !body.accidentSeverity
        ) {
            throw new BadRequestException(
                'Accident severity is required when accident history is Yes',
            );
        }

        // Do not accept accident severity when accident history is No or Not verified.
        if (
            body.accidentHistory !== true &&
            body.accidentSeverity != null
        ) {
            throw new BadRequestException(
                'Accident severity can only be provided when accident history is Yes',
            );
        }

        // Repaint coverage is required only when repaint history is Yes.
        if (
            body.repaintHistory === true &&
            !body.repaintCoverage
        ) {
            throw new BadRequestException(
                'Repaint coverage is required when repaint history is Yes',
            );
        }

        // Do not accept repaint coverage when repaint history is No or Not verified.
        if (
            body.repaintHistory !== true &&
            body.repaintCoverage != null
        ) {
            throw new BadRequestException(
                'Repaint coverage can only be provided when repaint history is Yes',
            );
        }

        return {
            condition: body.condition.toUpperCase(),
            notes: body.notes?.trim() || null,
            inspectionScore: body.inspectionScore ?? null,
            accidentHistory: body.accidentHistory ?? null,
            accidentSeverity: body.accidentSeverity ?? null,
            repaintHistory: body.repaintHistory ?? null,
            repaintCoverage: body.repaintCoverage ?? null,
            fullServiceHistory: body.fullServiceHistory ?? null,
        };
    }


    async saveInspection(
        vehicleId: string,
        body: {
            condition?: string;
            notes?: string;
            inspectionScore?: number;
            accidentHistory?: boolean | null;
            accidentSeverity?: 'MINOR' | 'MODERATE' | 'MAJOR' | null;
            repaintHistory?: boolean | null;
            repaintCoverage?: 'ONE_TO_TWO_PANELS' | 'THREE_TO_FIVE_PANELS' | 'FULL_BODY' | null;
            fullServiceHistory?: boolean | null;
        },
    ) {
        const inspection =
            this.validateInspectionInput(body);

        const vehicle = await this.prisma.vehicle.findUnique({
            where: { id: vehicleId },
            select: { id: true },
        });

        if (!vehicle) {
            throw new NotFoundException(
                'Vehicle not found',
            );
        }

        const savedInspection = await this.prisma.$transaction(
            async (tx) => {
                const saved = await tx.vehicleInspection.create({
                    data: {
                        vehicleId,
                        condition: inspection.condition,
                        notes: inspection.notes,
                        inspectionScore: inspection.inspectionScore,
                        accidentHistory: inspection.accidentHistory,
                        accidentSeverity: inspection.accidentSeverity,
                        repaintHistory: inspection.repaintHistory,
                        repaintCoverage: inspection.repaintCoverage,
                        fullServiceHistory: inspection.fullServiceHistory,
                    },
                });

                await tx.vehicle.update({
                    where: { id: vehicleId },
                    data: {
                        score: inspection.inspectionScore,
                    },
                });

                return saved;
            },
        );

        return {
            success: true,
            message: 'Vehicle inspection saved successfully',
            data: savedInspection,
        };
    }

    async getInspectionHistory(vehicleId: string) {
        const vehicle = await this.prisma.vehicle.findUnique({
            where: { id: vehicleId },
            select: { id: true },
        });

        if (!vehicle) {
            throw new NotFoundException('Vehicle not found');
        }

        const inspections = await this.prisma.vehicleInspection.findMany({
            where: { vehicleId },
            orderBy: { createdAt: 'desc' },
        });

        return {
            success: true,
            message: 'Inspection history fetched successfully',
            data: inspections,
        };
    }

}
