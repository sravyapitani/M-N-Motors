import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CalculateValuationDto } from './dto/calculate-valuation.dto';
import { ReviewValuationDto } from './dto/review-valuation.dto';

@Injectable()
export class ExchangeVehiclesValuationService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }




    async checkValuationEligibility(vehicleId: string) {

        // Step 1: Find the vehicle
        const vehicle = await this.prisma.vehicle.findUnique({
            where: { id: vehicleId },
            select: {
                id: true,
                rcBookStatus: true,
                loanStatus: true,
                nocReceived: true,
            },
        });

        // Step 2: Check whether the vehicle exists
        if (!vehicle) {
            throw new NotFoundException('Vehicle not found');
        }

        // Step 3: Check RC Book risk
        const automaticValuationAllowed =
            vehicle.rcBookStatus === 'GENUINE';

        const manualReviewRequired =
            vehicle.rcBookStatus === 'HIGH_RISK';

        const rcVerificationRequired =
            vehicle.rcBookStatus === 'NOT_SCANNED' ||
            vehicle.rcBookStatus === 'NEEDS_VERIFICATION';


        // Step 4: Loan/NOC status must not block valuation calculation
        let loanRequirementPassed = true;
        let loanMessage = 'No outstanding loan requirement detected';

        if (vehicle.loanStatus === 'UNKNOWN') {
            loanRequirementPassed = false;
            loanMessage =
                'Loan status is not verified. Valuation can proceed, but final settlement requires verification.';
        } else if (
            vehicle.loanStatus === 'OUTSTANDING' &&
            !vehicle.nocReceived
        ) {
            loanRequirementPassed = false;
            loanMessage =
                'Outstanding loan detected and NOC is pending. Valuation can proceed, but final settlement is blocked.';
        } else if (
            vehicle.loanStatus === 'OUTSTANDING' &&
            vehicle.nocReceived
        ) {
            loanMessage = 'Outstanding loan recorded and NOC received.';
        } else if (vehicle.loanStatus === 'CLEARED') {
            loanMessage = 'Loan is cleared.';
        }

        // Step 5: Allow indicative valuation calculation independently of RC verification
        const valuationCalculationAllowed = true;

        // Final offer requires genuine RC verification and completed loan/NOC requirements
        const offerFinalizationAllowed =
            automaticValuationAllowed && loanRequirementPassed;

        // Step 5: Finalization eligibility


        return {
            success: true,
            message: 'Vehicle valuation eligibility checked successfully',

            data: {
                vehicleId: vehicle.id,

                rcBook: {
                    status: vehicle.rcBookStatus,
                    automaticValuationAllowed,
                    manualReviewRequired,
                    rcVerificationRequired,
                },

                loan: {
                    status: vehicle.loanStatus,
                    nocReceived: vehicle.nocReceived,
                    requirementPassed: loanRequirementPassed,
                    message: loanMessage,
                },

                valuationCalculationAllowed,
                offerFinalizationAllowed,
                finalizationBlockedReason: !loanRequirementPassed
                    ? loanMessage
                    : null,
            },
        };
    }
    // Fetch the matching base reference price
    async getBaseReferencePrice(vehicleId: string) {

        // Step 1: Fetch vehicle details
        const vehicle = await this.prisma.vehicle.findUnique({
            where: { id: vehicleId },
            select: {
                id: true,
                make: true,
                model: true,
                variant: true,
                modelYear: true,
            },
        });

        // Step 2: Check vehicle existence
        if (!vehicle) {
            throw new NotFoundException('Vehicle not found');
        }

        // Step 3: Validate required vehicle details
        if (
            !vehicle.make ||
            !vehicle.model ||
            !vehicle.variant ||
            vehicle.modelYear === null
        ) {
            throw new BadRequestException(
                'Make, model, variant and model year are required for base price lookup',
            );
        }

        // Step 4: Find matching active reference price
        const basePrice = await this.prisma.vehicleBasePrice.findFirst({
            where: {
                make: vehicle.make,
                model: vehicle.model,
                variant: vehicle.variant,
                modelYear: vehicle.modelYear,
                isActive: true,
            },
        });

        // Step 5: Check whether reference price exists
        if (!basePrice) {
            throw new NotFoundException(
                `Base reference price is not configured for ${vehicle.make} ${vehicle.model} ${vehicle.variant} (${vehicle.modelYear}). Please contact the administrator to configure the vehicle price catalogue.`,
            );
        }

        return {
            success: true,
            message: 'Base reference price fetched successfully',
            data: {
                vehicleId: vehicle.id,
                make: basePrice.make,
                model: basePrice.model,
                variant: basePrice.variant,
                modelYear: basePrice.modelYear,
                basePrice: basePrice.basePrice,
            },
        };
    }
    // Calculate age depreciation using database rules
    async getAgeDepreciation(vehicleId: string) {
        const vehicle = await this.prisma.vehicle.findUnique({
            where: { id: vehicleId },
            select: {
                id: true,
                registrationDate: true,
            },
        });

        if (!vehicle) {
            throw new NotFoundException('Vehicle not found');
        }

        if (!vehicle.registrationDate) {
            throw new BadRequestException(
                'Vehicle registration date is required for age depreciation',
            );
        }

        const today = new Date();
        const registrationDate = new Date(vehicle.registrationDate);

        let ageInMonths =
            (today.getFullYear() - registrationDate.getFullYear()) * 12 +
            (today.getMonth() - registrationDate.getMonth());

        if (today.getDate() < registrationDate.getDate()) {
            ageInMonths--;
        }
        if (ageInMonths < 0) {
            throw new BadRequestException(
                'Vehicle registration date cannot be in the future.',
            );
        }

        ageInMonths = Math.max(1, ageInMonths);
        const rule = await this.prisma.valuationRule.findFirst({
            where: {
                ruleKey: 'AGE_DEPRECIATION',
                isActive: true,
            },
            include: {
                bands: {
                    orderBy: { sortOrder: 'asc' },
                },
            },
        });

        if (!rule) {
            throw new NotFoundException(
                'Age depreciation rule is not configured',
            );
        }

        const band = rule.bands.find((item) => {
            const min = Number(item.minValue);
            const max = item.maxValue === null
                ? null
                : Number(item.maxValue);

            return (
                ageInMonths >= min &&
                (max === null || ageInMonths < max)
            );
        });

        if (!band) {
            throw new BadRequestException(
                'No matching age depreciation band found',
            );
        }

        if (band.unit === 'NEGOTIATED') {
            return {
                success: true,
                vehicleId: vehicle.id,
                ageInMonths,
                depreciationType: 'NEGOTIATED',
                message: 'Vehicle is above 5 years and requires negotiated valuation',
            };
        }

        return {
            success: true,
            vehicleId: vehicle.id,
            ageInMonths,
            depreciationPercentage: Number(band.ruleValue),
            bandKey: band.bandKey,
        };
    }
    // Fetch mileage adjustment configuration

    async getMileageAdjustment(vehicleId: string) {
        const vehicle = await this.prisma.vehicle.findUnique({
            where: { id: vehicleId },
            select: {
                id: true,
                odometerKm: true,
                registrationDate: true,
                fuelType: true,
                vehicleSegment: true,
            },
        });

        if (!vehicle) {
            throw new NotFoundException('Vehicle not found');
        }

        if (!vehicle.registrationDate || vehicle.odometerKm === null) {
            throw new BadRequestException(
                'Registration date and odometer reading are required for mileage adjustment',
            );
        }

        if (!vehicle.fuelType || !vehicle.vehicleSegment) {
            throw new BadRequestException(
                'Fuel type and vehicle segment are required for mileage adjustment',
            );
        }

        const rule = await this.prisma.valuationRule.findFirst({
            where: {
                ruleKey: 'MILEAGE_ADJUSTMENT',
                isActive: true,
            },
            include: {
                bands: {
                    orderBy: { sortOrder: 'asc' },
                },
            },
        });

        if (!rule || rule.bands.length === 0) {
            throw new NotFoundException(
                'Mileage adjustment bands are not configured',
            );
        }

        const aboveBand = rule.bands.find(
            (band) => band.bandKey === 'ABOVE_EXPECTED',
        );
        const belowBand = rule.bands.find(
            (band) => band.bandKey === 'BELOW_EXPECTED',
        );

        if (!aboveBand || !belowBand) {
            throw new BadRequestException(
                'Required mileage adjustment bands are missing',
            );
        }

        const aboveConditions = aboveBand.conditions as
            | { expectedAnnualKm?: Record<string, number> }
            | null;

        const expectedAnnualKm =
            vehicle.vehicleSegment === 'COMMERCIAL' ||
                vehicle.vehicleSegment === 'THREE_WHEELER'
                ? 20000
                : aboveConditions?.expectedAnnualKm?.[vehicle.fuelType];

        if (!expectedAnnualKm) {
            throw new BadRequestException(
                'Expected annual mileage is not configured for this vehicle',
            );
        }

        const ageInYears =
            (Date.now() - vehicle.registrationDate.getTime()) /
            (365.25 * 24 * 60 * 60 * 1000);

        const expectedLifetimeKm = expectedAnnualKm * ageInYears;
        const differenceKm = Number(vehicle.odometerKm) - expectedLifetimeKm;

        let adjustmentPercentage = 0;
        let adjustmentType = 'NORMAL';

        if (differenceKm > 0) {
            const units = Math.floor(differenceKm / 1000);
            adjustmentPercentage = Math.max(
                -15,
                units * Number(aboveBand.ruleValue),
            );
            adjustmentType = 'ABOVE_EXPECTED';
        } else if (differenceKm < 0) {
            const units = Math.floor(Math.abs(differenceKm) / 1000);
            adjustmentPercentage = Math.min(
                5,
                units * Number(belowBand.ruleValue),
            );
            adjustmentType = 'BELOW_EXPECTED';
        }

        return {
            success: true,
            vehicleId: vehicle.id,
            odometerKm: Number(vehicle.odometerKm),
            expectedAnnualKm,
            expectedLifetimeKm: Number(expectedLifetimeKm.toFixed(2)),
            differenceKm: Number(differenceKm.toFixed(2)),
            adjustmentType,
            adjustmentPercentage: Number(adjustmentPercentage.toFixed(2)),
            adjustmentCalculated: true,
        };
    }



    async getConditionAdjustment(vehicleId: string) {
        const vehicle = await this.prisma.vehicle.findUnique({
            where: { id: vehicleId },
            select: {
                id: true,
                inspections: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
        });

        if (!vehicle) {
            throw new NotFoundException('Vehicle not found');
        }

        const inspection = vehicle.inspections[0];

        if (!inspection) {
            throw new BadRequestException(
                'Vehicle inspection is required for condition adjustment',
            );
        }

        const rule = await this.prisma.valuationRule.findFirst({
            where: {
                ruleKey: 'CONDITION_ADJUSTMENT',
                isActive: true,
            },
            include: {
                bands: {
                    orderBy: { sortOrder: 'asc' },
                },
            },
        });

        if (!rule || rule.bands.length === 0) {
            throw new NotFoundException(
                'Condition adjustment bands are not configured',
            );
        }

        const score = Number(inspection.inspectionScore);

        if (!Number.isFinite(score) || score < 0 || score > 100) {
            throw new BadRequestException(
                'A valid inspection score between 0 and 100 is required',
            );
        }

        const band = rule.bands.find(
            (item) =>
                item.minValue !== null &&
                item.maxValue !== null &&
                score >= Number(item.minValue) &&
                score <= Number(item.maxValue),
        );

        if (!band) {
            throw new BadRequestException(
                `No condition adjustment band found for score ${score}`,
            );
        }

        return {
            success: true,
            vehicleId: vehicle.id,
            inspection: {
                condition: inspection.condition,
                inspectionScore: score,
            },
            bandKey: band.bandKey,
            adjustmentPercentage: Number(band.ruleValue),
            adjustmentCalculated: true,
            managerApprovalRequired: band.bandKey === 'VERY_POOR',
        };
    }



    async getExtraOwnerDeduction(vehicleId: string) {
        const vehicle = await this.prisma.vehicle.findUnique({
            where: { id: vehicleId },
            select: {
                id: true,
                previousOwnerCount: true,
            },
        });

        if (!vehicle) {
            throw new NotFoundException('Vehicle not found');
        }

        if (
            vehicle.previousOwnerCount === null ||
            vehicle.previousOwnerCount < 1
        ) {
            throw new BadRequestException(
                'Previous owner count must be at least 1',
            );
        }

        const rule = await this.prisma.valuationRule.findFirst({
            where: {
                ruleKey: 'EXTRA_OWNER_DEDUCTION',
                isActive: true,
            },
            include: {
                bands: {
                    orderBy: { sortOrder: 'asc' },
                },
            },
        });

        if (!rule || rule.bands.length === 0) {
            throw new NotFoundException(
                'Extra owner deduction bands are not configured',
            );
        }

        const band = rule.bands.find(
            (item) => item.bandKey === 'ADDITIONAL_OWNER',
        );

        if (!band) {
            throw new BadRequestException(
                'Additional owner deduction band is missing',
            );
        }

        const extraOwnerCount = vehicle.previousOwnerCount - 1;
        const conditions = band.conditions as
            | { maximumDeduction?: number }
            | null;

        const maximumDeduction = conditions?.maximumDeduction ?? 12;

        const adjustmentPercentage = Math.max(
            -maximumDeduction,
            extraOwnerCount * Number(band.ruleValue),
        );

        return {
            success: true,
            vehicleId: vehicle.id,
            previousOwnerCount: vehicle.previousOwnerCount,
            extraOwnerCount,
            adjustmentPercentage: Number(adjustmentPercentage.toFixed(2)),
            deductionCalculated: true,
        };
    }


    // Fetch accident and repaint deduction configuration

    async getAccidentRepaintDeduction(vehicleId: string) {
        const vehicle = await this.prisma.vehicle.findUnique({
            where: { id: vehicleId },
            select: {
                id: true,
                inspections: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
        });

        if (!vehicle) {
            throw new NotFoundException('Vehicle not found');
        }

        const inspection = vehicle.inspections[0];

        if (!inspection) {
            throw new BadRequestException(
                'Vehicle inspection is required for accident/repaint assessment',
            );
        }

        const rule = await this.prisma.valuationRule.findFirst({
            where: {
                ruleKey: 'ACCIDENT_REPAINT_DEDUCTION',
                isActive: true,
            },
            include: {
                bands: {
                    orderBy: { sortOrder: 'asc' },
                },
            },
        });

        if (!rule || rule.bands.length === 0) {
            throw new NotFoundException(
                'Accident/repaint deduction bands are not configured',
            );
        }

        let accidentDeduction = 0;
        let repaintDeduction = 0;
        let accidentBandKey: string | null = null;
        let repaintBandKey: string | null = null;

        if (inspection.accidentHistory) {
            if (!inspection.accidentSeverity) {
                throw new BadRequestException(
                    'Accident severity is required when accident history is recorded',
                );
            }

            accidentBandKey = `ACCIDENT_${inspection.accidentSeverity}`;

            const accidentBand = rule.bands.find(
                (band) => band.bandKey === accidentBandKey,
            );

            if (!accidentBand) {
                throw new BadRequestException(
                    `Accident deduction band ${accidentBandKey} is missing`,
                );
            }

            accidentDeduction = Number(accidentBand.ruleValue);
        }

        if (inspection.repaintHistory) {
            if (!inspection.repaintCoverage) {
                throw new BadRequestException(
                    'Repaint coverage is required when repaint history is recorded',
                );
            }

            const repaintBandKeys: Record<string, string> = {
                ONE_TO_TWO_PANELS: 'REPAINT_1_2_PANELS',
                THREE_TO_FIVE_PANELS: 'REPAINT_3_5_PANELS',
                FULL_BODY: 'REPAINT_FULL_BODY',
            };

            repaintBandKey =
                repaintBandKeys[inspection.repaintCoverage];

            if (!repaintBandKey) {
                throw new BadRequestException(
                    'Invalid repaint coverage',
                );
            }

            const repaintBand = rule.bands.find(
                (band) => band.bandKey === repaintBandKey,
            );

            if (!repaintBand) {
                throw new BadRequestException(
                    `Repaint deduction band ${repaintBandKey} is missing`,
                );
            }

            repaintDeduction = Number(repaintBand.ruleValue);
        }

        return {
            success: true,
            vehicleId: vehicle.id,
            accidentHistory: inspection.accidentHistory,
            accidentBandKey,
            accidentDeduction,
            repaintHistory: inspection.repaintHistory,
            repaintBandKey,
            repaintDeduction,
            adjustmentPercentage: Number(
                (accidentDeduction + repaintDeduction).toFixed(2),
            ),
            managerApprovalRequired:
                inspection.accidentHistory === true &&
                inspection.accidentSeverity === 'MAJOR',
            deductionCalculated: true,
        };
    }


    // Fetch full service history premium configuration

    async getServiceHistoryPremium(vehicleId: string) {
        const vehicle = await this.prisma.vehicle.findUnique({
            where: { id: vehicleId },
            select: {
                id: true,
                inspections: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
        });

        if (!vehicle) {
            throw new NotFoundException('Vehicle not found');
        }

        const inspection = vehicle.inspections[0];

        if (!inspection) {
            throw new BadRequestException(
                'Vehicle inspection is required for service history assessment',
            );
        }

        const rule = await this.prisma.valuationRule.findFirst({
            where: {
                ruleKey: 'SERVICE_HISTORY_PREMIUM',
                isActive: true,
            },
            include: {
                bands: {
                    orderBy: { sortOrder: 'asc' },
                },
            },
        });

        if (!rule || rule.bands.length === 0) {
            throw new NotFoundException(
                'Service history premium bands are not configured',
            );
        }

        const bandKey = inspection.fullServiceHistory
            ? 'COMPLETE_AUTHORISED'
            : 'PARTIAL_OR_MISSING';

        const band = rule.bands.find(
            (item) => item.bandKey === bandKey,
        );

        if (!band) {
            throw new BadRequestException(
                `Service history band ${bandKey} is missing`,
            );
        }

        return {
            success: true,
            vehicleId: vehicle.id,
            fullServiceHistory: inspection.fullServiceHistory,
            bandKey,
            adjustmentPercentage: Number(band.ruleValue),
            premiumCalculated: true,
        };
    }


    // Check whether all valuation rules are configured
    async checkValuationConfiguration() {
        const requiredRules = [
            'AGE_DEPRECIATION',
            'MILEAGE_ADJUSTMENT',
            'CONDITION_ADJUSTMENT',
            'EXTRA_OWNER_DEDUCTION',
            'ACCIDENT_REPAINT_DEDUCTION',
            'SERVICE_HISTORY_PREMIUM',
        ];

        const rules = await this.prisma.valuationRule.findMany({
            where: {
                ruleKey: {
                    in: requiredRules,
                },
                isActive: true,
            },
            include: {
                bands: {
                    orderBy: {
                        sortOrder: 'asc',
                    },
                },
            },
        });

        const configuredRules = rules.map((rule) => ({
            ruleKey: rule.ruleKey,
            bandCount: rule.bands.length,
            configured: rule.bands.length > 0,
        }));

        const missingRules = requiredRules.filter(
            (key) =>
                !configuredRules.some(
                    (rule) =>
                        rule.ruleKey === key && rule.configured,
                ),
        );

        return {
            success: true,
            readyForCalculation: missingRules.length === 0,
            configuredRules,
            missingRules,
            message:
                missingRules.length === 0
                    ? 'All required valuation rules have bands configured.'
                    : 'Valuation cannot proceed until all required rule bands are configured.',
        };
    }
    // Calculate vehicle value after age depreciation
    private calculateAgeDepreciatedValue(
        basePrice: number,
        depreciationPercentage: number,
    ): number {
        if (
            !Number.isFinite(basePrice) ||
            !Number.isFinite(depreciationPercentage) ||
            basePrice <= 0 ||
            depreciationPercentage < 0 ||
            depreciationPercentage > 100
        ) {
            throw new BadRequestException(
                'Invalid base price or age depreciation percentage',
            );
        }

        const depreciationAmount =
            (basePrice * depreciationPercentage) / 100;

        return Number(
            (basePrice - depreciationAmount).toFixed(2),
        );
    }
    // Main valuation calculation entry point


    async calculateValuation(
        vehicleId: string,
        dto: CalculateValuationDto,
    ) {
        // 1. Check vehicle eligibility
        const eligibility =
            await this.checkValuationEligibility(vehicleId);

        if (!eligibility.data.valuationCalculationAllowed) {
            const reason = !eligibility.data.rcBook.automaticValuationAllowed
                ? `RC Book status is ${eligibility.data.rcBook.status}.`
                : eligibility.data.loan.message;

            throw new BadRequestException({
                message: `Vehicle is not eligible for automatic valuation. ${reason}`,
                eligibility: eligibility.data,
            });
        }

        // 2. Check rule configuration
        const configuration = await this.checkValuationConfiguration();

        if (!configuration.readyForCalculation) {
            throw new BadRequestException({
                message: 'Valuation rules are not completely configured.',
                missingRules: configuration.missingRules,
            });
        }



        // 3. Fetch base price and age depreciation
        const basePriceResponse =
            await this.getBaseReferencePrice(vehicleId);

        const basePrice = Number(basePriceResponse.data.basePrice);

        const ageDepreciation =
            await this.getAgeDepreciation(vehicleId);

        let calculationBaseValue: number;
        let ageAdjustedValue: number;
        let negotiatedBaseValue: number | null = null;

        if (ageDepreciation.depreciationType === 'NEGOTIATED') {
            if (
                dto.negotiatedBaseValue === undefined ||
                !Number.isFinite(dto.negotiatedBaseValue) ||
                dto.negotiatedBaseValue <= 0
            ) {
                throw new BadRequestException(
                    'A valid negotiated base value is required for vehicles above 5 years.',
                );
            }

            negotiatedBaseValue = dto.negotiatedBaseValue;
            calculationBaseValue = negotiatedBaseValue;
            ageAdjustedValue = negotiatedBaseValue;
        } else {
            if (dto.negotiatedBaseValue !== undefined) {
                throw new BadRequestException(
                    'Negotiated base value is only allowed for vehicles above 5 years.',
                );
            }

            calculationBaseValue = basePrice;

            ageAdjustedValue =
                this.calculateAgeDepreciatedValue(
                    basePrice,
                    ageDepreciation.depreciationPercentage,
                );
        }


        // 4. Calculate all adjustments
        const [
            mileage,
            condition,
            owners,
            accidentRepaint,
            serviceHistory,
        ] = await Promise.all([
            this.getMileageAdjustment(vehicleId),
            this.getConditionAdjustment(vehicleId),
            this.getExtraOwnerDeduction(vehicleId),
            this.getAccidentRepaintDeduction(vehicleId),
            this.getServiceHistoryPremium(vehicleId),
        ]);

        // 5. Add adjustment percentages and apply the overall cap
        const rawAdjustmentPercentage =
            mileage.adjustmentPercentage +
            condition.adjustmentPercentage +
            owners.adjustmentPercentage +
            accidentRepaint.adjustmentPercentage +
            serviceHistory.adjustmentPercentage;

        const adjustmentOutsideCap =
            rawAdjustmentPercentage < -35 ||
            rawAdjustmentPercentage > 10;

        const finalAdjustmentPercentage = Math.max(
            -35,
            Math.min(10, rawAdjustmentPercentage),
        );

        const suggestedValue = Number(
            (
                ageAdjustedValue *
                (1 + finalAdjustmentPercentage / 100)
            ).toFixed(2),
        );

        // 6. Check evaluator quote and deviation
        const approvalRule =
            await this.prisma.valuationRule.findFirst({
                where: {
                    ruleKey: 'APPROVAL_DEVIATION_THRESHOLD',
                    isActive: true,
                },
                include: {
                    bands: {
                        orderBy: { sortOrder: 'asc' },
                    },
                },
            });

        if (!approvalRule || approvalRule.bands.length === 0) {
            throw new BadRequestException(
                'Approval deviation thresholds are not configured.',
            );
        }

        let deviationPercentage: number | null = null;
        let deviationBand: string | null = null;
        let managerApprovalRequired =
            adjustmentOutsideCap ||
            condition.managerApprovalRequired ||
            accidentRepaint.managerApprovalRequired;

        if (dto.evaluatorQuotedValue !== undefined) {
            if (suggestedValue <= 0) {
                throw new BadRequestException(
                    'Suggested value must be greater than zero.',
                );
            }

            deviationPercentage = Number(
                (
                    (Math.abs(dto.evaluatorQuotedValue - suggestedValue) /
                        suggestedValue) *
                    100
                ).toFixed(2),
            );

            const deviationBandConfig = approvalRule.bands.find(
                (band) =>
                    deviationPercentage! >= Number(band.minValue ?? 0) &&
                    (band.maxValue === null ||
                        deviationPercentage! <= Number(band.maxValue)),
            );

            if (!deviationBandConfig) {
                throw new BadRequestException(
                    'No approval threshold matches the evaluator deviation.',
                );
            }

            deviationBand = deviationBandConfig.bandKey;

            if (deviationBand === 'MANAGER_APPROVAL') {
                managerApprovalRequired = true;
            }

            if (
                deviationBand === 'REASON_REQUIRED' &&
                !dto.evaluatorRemarks?.trim()
            ) {
                throw new BadRequestException(
                    'Evaluator remarks are required when deviation is above 5%.',
                );
            }
        }


        // 7. All calculated valuations require manual manager approval
        const status = 'PENDING_APPROVAL';

        const finalValue = null;

        // Manager approval is mandatory for every calculated valuation
        managerApprovalRequired = true;

        // 8. Save valuation and calculation snapshot
        const snapshot = {
            basePrice,
            negotiatedBaseValue,
            calculationBaseValue,
            ageDepreciation,
            ageAdjustedValue,
            mileage,
            condition,
            owners,
            accidentRepaint,
            serviceHistory,
            rawAdjustmentPercentage,
            finalAdjustmentPercentage,
            adjustmentOutsideCap,
            suggestedValue,
            evaluatorQuotedValue: dto.evaluatorQuotedValue ?? null,
            deviationPercentage,
            deviationBand,
            managerApprovalRequired,
        };

        const savedValuation =
            await this.prisma.vehicleValuation.create({
                data: {
                    vehicleId,
                    suggestedValue,
                    evaluatorQuotedValue:
                        dto.evaluatorQuotedValue ?? null,
                    finalValue,
                    status,
                    calculationSnapshot: JSON.parse(
                        JSON.stringify(snapshot),
                    ),
                    evaluatorRemarks:
                        dto.evaluatorRemarks ?? null,
                    ...(status === 'PENDING_APPROVAL'
                        ? {
                            approvals: {
                                create: {
                                    decision: 'PENDING',
                                    remarks:
                                        'Manager approval required for valuation.',
                                },
                            },
                        }
                        : {}),
                },
            });
        // Move vehicle to VALUATION stage after successful calculation
        await this.prisma.vehicle.update({
            where: { id: vehicleId },
            data: { stage: 'VALUATION' },
        });

        return {
            success: true,
            message: 'Vehicle valuation calculated and saved successfully.',
            data: {
                valuationId: savedValuation.id,
                vehicleId,
                basePrice,
                ageAdjustedValue,
                mileageAdjustment: mileage.adjustmentPercentage,
                conditionAdjustment: condition.adjustmentPercentage,
                ownerDeduction: owners.adjustmentPercentage,
                accidentRepaintAdjustment:
                    accidentRepaint.adjustmentPercentage,
                serviceHistoryPremium:
                    serviceHistory.adjustmentPercentage,
                rawAdjustmentPercentage,
                finalAdjustmentPercentage,
                adjustmentOutsideCap,
                suggestedValue,
                evaluatorQuotedValue: dto.evaluatorQuotedValue ?? null,
                deviationPercentage,
                deviationBand,
                finalValue,
                status,
                managerApprovalRequired,
                finalValuationSaved: true,
            },
        };
    }

    // Get the latest valuation for a vehicle
    async getLatestValuation(vehicleId: string) {
        const valuation = await this.prisma.vehicleValuation.findFirst({
            where: { vehicleId },
            orderBy: { calculatedAt: 'desc' },
            include: {
                approvals: {
                    orderBy: { requestedAt: 'desc' },
                },
            },
        });

        if (!valuation) {
            throw new NotFoundException(
                'No valuation found for this vehicle.',
            );
        }

        return {
            success: true,
            data: valuation,
        };
    }

    // Get complete valuation history for a vehicle
    async getValuationHistory(vehicleId: string) {
        const vehicle = await this.prisma.vehicle.findUnique({
            where: { id: vehicleId },
            select: { id: true },
        });

        if (!vehicle) {
            throw new NotFoundException('Vehicle not found.');
        }

        const history = await this.prisma.vehicleValuation.findMany({
            where: { vehicleId },
            orderBy: { calculatedAt: 'desc' },
            include: {
                approvals: {
                    orderBy: { requestedAt: 'desc' },
                },
            },
        });

        return {
            success: true,
            count: history.length,
            data: history,
        };
    }

    // Manager approves or rejects a pending valuation
    async reviewValuation(
        valuationId: string,
        dto: ReviewValuationDto,
    ) {
        const valuation =
            await this.prisma.vehicleValuation.findUnique({
                where: { id: valuationId },
                include: {
                    approvals: true,
                },
            });

        if (!valuation) {
            throw new NotFoundException('Valuation not found.');
        }

        if (valuation.status !== 'PENDING_APPROVAL') {
            throw new BadRequestException(
                'Only valuations pending approval can be reviewed.',
            );
        }

        const pendingApproval = valuation.approvals.find(
            (approval) => approval.decision === 'PENDING',
        );

        if (!pendingApproval) {
            throw new BadRequestException(
                'No pending approval record found for this valuation.',
            );
        }


        if (
            dto.decision === 'REJECTED' &&
            !dto.remarks?.trim()
        ) {
            throw new BadRequestException(
                'Remarks are required when rejecting a valuation.',
            );
        }

        // Manager must enter a fixed final amount when approving
        if (
            dto.decision === 'APPROVED' &&
            (dto.finalValue === undefined ||
                !Number.isFinite(dto.finalValue) ||
                dto.finalValue <= 0)
        ) {
            throw new BadRequestException(
                'A valid final valuation amount is required for approval.',
            );
        }

        const finalValue =
            dto.decision === 'APPROVED'
                ? dto.finalValue!
                : null;



        const result = await this.prisma.$transaction(async (tx) => {
            const approval = await tx.vehicleValuationApproval.update({
                where: { id: pendingApproval.id },
                data: {
                    decision: dto.decision,
                    reviewerName: dto.reviewerName.trim(),
                    remarks: dto.remarks?.trim() ?? null,
                    decidedAt: new Date(),
                },
            });

            const updatedValuation =
                await tx.vehicleValuation.update({
                    where: { id: valuationId },
                    data: {
                        status: dto.decision,
                        finalValue,
                    },
                });

            // Move vehicle to APPROVAL stage only after manager approval
            if (dto.decision === 'APPROVED') {
                await tx.vehicle.update({
                    where: { id: valuation.vehicleId },
                    data: { stage: 'APPROVAL' },
                });
            }

            return {
                approval,
                valuation: updatedValuation,
            };
        });


        return {
            success: true,
            message:
                dto.decision === 'APPROVED'
                    ? 'Valuation approved successfully.'
                    : 'Valuation rejected.',
            data: result,
        };
    }

}
