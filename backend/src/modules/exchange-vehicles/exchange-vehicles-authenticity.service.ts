
import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface RcExtractedFields {
    registrationNumber?: string | null;
    chassisNumber?: string | null;
    engineNumber?: string | null;
    vehicleColour?: string | null;
    hypothecationDetails?: string | null;
    financierName?: string | null;
}

@Injectable()
export class ExchangeVehiclesAuthenticityService {
    constructor(private readonly prisma: PrismaService) { }

    async assessVehicle(
        vehicleId: string,
        extractedFields: RcExtractedFields,
    ) {
        const vehicle = await this.prisma.vehicle.findUnique({
            where: { id: vehicleId },
            include: {
                documents: {
                    where: { isCurrent: true },
                },
            },
        });

        if (!vehicle) {
            throw new NotFoundException('Vehicle not found');
        }

        // Load currently active rules from the database.
        const now = new Date();

        const rules = await this.prisma.rcBookRule.findMany({
            where: {
                isActive: true,
                AND: [
                    {
                        OR: [
                            { effectiveFrom: null },
                            { effectiveFrom: { lte: now } },
                        ],
                    },
                    {
                        OR: [
                            { effectiveTo: null },
                            { effectiveTo: { gte: now } },
                        ],
                    },
                ],
            },
        });

        const normalize = (value?: string | null) =>
            value?.replace(/\s+/g, '').toUpperCase() || null;

        const fields = [
            {
                ruleKey: 'REGISTRATION_MISMATCH',
                missingRuleKey: 'REGISTRATION_MISSING',
                field: 'Registration Number',
                extracted: extractedFields.registrationNumber,
                stored: vehicle.registrationNumber,
            },
            {
                ruleKey: 'CHASSIS_MISMATCH',
                missingRuleKey: 'CHASSIS_MISSING',
                field: 'Chassis Number',
                extracted: extractedFields.chassisNumber,
                stored: vehicle.chassisNumber,
            },
            {
                ruleKey: 'ENGINE_MISMATCH',
                missingRuleKey: 'ENGINE_MISSING',
                field: 'Engine Number',
                extracted: extractedFields.engineNumber,
                stored: vehicle.engineNumber,
            },
            {
                ruleKey: 'COLOUR_MISMATCH',
                missingRuleKey: 'COLOUR_MISSING',
                field: 'Vehicle Colour',
                extracted: extractedFields.vehicleColour,
                stored: vehicle.colour,
            },
        ];

        const comparison = fields.map((item) => {
            const rcValue = normalize(item.extracted);
            const vehicleValue = normalize(item.stored);

            let result: 'MATCH' | 'MISMATCH' | 'NOT_AVAILABLE';

            if (!rcValue || !vehicleValue) {
                result = 'NOT_AVAILABLE';
            } else {
                result =
                    rcValue === vehicleValue ? 'MATCH' : 'MISMATCH';
            }

            return {
                field: item.field,
                rcBookValue: item.extracted ?? null,
                vehicleRecordValue: item.stored ?? null,
                result,
            };
        });

        // Assess hypothecation information extracted from RC Book
        const hypothecationText =
            extractedFields.hypothecationDetails?.trim() || '';

        const financier = extractedFields.financierName?.trim() || null;

        const extractedTextForDocumentCheck = Object.values(extractedFields)
            .filter((value) => typeof value === 'string')
            .join(' ')
            .toUpperCase();

        const isSyntheticTestDocument =
            /INTENTIONALLY SYNTHETIC TEST DATA|FRESH TEST ONLY|NOT VALID|TEST SAFETY NOTICE|FIELD SYNTHETIC TEST VALUE|SYNTHETIC TEST DOCUMENT/.test(
                extractedTextForDocumentCheck,
            );

        let hypothecationStatus:
            | 'HYPOTHECATED'
            | 'NOT_HYPOTHECATED'
            | 'UNKNOWN' = 'UNKNOWN';

        if (isSyntheticTestDocument) {
            hypothecationStatus = 'UNKNOWN';
        } else if (financier) {
            hypothecationStatus = 'HYPOTHECATED';
        } else if (
            /no\s+hypothecation|hypothecation\s*[:\-]?\s*(none|nil|not applicable)/i
                .test(hypothecationText)
        ) {
            hypothecationStatus = 'NOT_HYPOTHECATED';
        }

        const hypothecationNeedsReview =
            hypothecationStatus === 'UNKNOWN';

        let totalRiskScore = 0;



        const riskFlags: Array<{
            ruleKey: string;
            ruleName: string;
            category: string;
            weight: number;
            message: string;
        }> = [];

        if (isSyntheticTestDocument) {
            riskFlags.push({
                ruleKey: 'SYNTHETIC_TEST_DOCUMENT',
                ruleName: 'Synthetic Test Document',
                category: 'DOCUMENT_AUTHENTICITY',
                weight: 0,
                message:
                    'This document contains an explicit synthetic test-data notice. It is not a genuine RC Book and must not be used for real vehicle verification.',
            });
        }

        const checkResults: Array<{
            ruleKey: string;
            ruleName: string;
            passed: boolean;
            result: string;
            weightApplied: number;
        }> = [];


        if (hypothecationNeedsReview) {
            const hypothecationRule = rules.find(
                (rule) =>
                    rule.ruleKey === 'HYPOTHECATION_INFORMATION_UNCLEAR',
            );

            if (!hypothecationRule) {
                throw new Error(
                    'HYPOTHECATION_INFORMATION_UNCLEAR rule is not configured. Please seed the RC Book rules.',
                );
            }

            totalRiskScore += hypothecationRule.weight;

            riskFlags.push({
                ruleKey: hypothecationRule.ruleKey,
                ruleName: hypothecationRule.ruleName,
                category: hypothecationRule.category,
                weight: hypothecationRule.weight,
                message:
                    'Hypothecation information could not be reliably identified from the RC Book. Manual verification is required.',
            });

            checkResults.push({
                ruleKey: hypothecationRule.ruleKey,
                ruleName: hypothecationRule.ruleName,
                passed: false,
                result: 'NOT_AVAILABLE',
                weightApplied: hypothecationRule.weight,
            });
        }


        for (const item of fields) {
            const comparisonResult = comparison.find(
                (entry) => entry.field === item.field,
            );

            if (!comparisonResult) continue;

            if (comparisonResult.result === 'MISMATCH') {
                const rule = rules.find(
                    (entry) => entry.ruleKey === item.ruleKey,
                );

                if (rule) {
                    totalRiskScore += rule.weight;

                    riskFlags.push({
                        ruleKey: rule.ruleKey,
                        ruleName: rule.ruleName,
                        category: rule.category,
                        weight: rule.weight,
                        message: `${item.field} does not match the vehicle record.`,
                    });

                    checkResults.push({
                        ruleKey: rule.ruleKey,
                        ruleName: rule.ruleName,
                        passed: false,
                        result: 'MISMATCH',
                        weightApplied: rule.weight,
                    });
                }
            } else if (
                comparisonResult.result === 'MATCH'
            ) {
                const rule = rules.find(
                    (entry) => entry.ruleKey === item.ruleKey,
                );

                if (rule) {
                    checkResults.push({
                        ruleKey: rule.ruleKey,
                        ruleName: rule.ruleName,
                        passed: true,
                        result: 'MATCH',
                        weightApplied: 0,
                    });
                }
            }

            // Missing OCR fields are recorded as incomplete evidence,
            // not as proof of tampering and not as risk-score points.

            if (!normalize(item.extracted)) {
                const missingRule = rules.find(
                    (entry) => entry.ruleKey === item.missingRuleKey,
                );

                if (!missingRule) {
                    throw new Error(
                        `${item.missingRuleKey} rule is not configured. Please seed the RC Book rules.`,
                    );
                }

                totalRiskScore += missingRule.weight;

                riskFlags.push({
                    ruleKey: missingRule.ruleKey,
                    ruleName: missingRule.ruleName,
                    category: missingRule.category,
                    weight: missingRule.weight,
                    message: `${item.field} could not be extracted. Manual document review is required.`,
                });

                checkResults.push({
                    ruleKey: missingRule.ruleKey,
                    ruleName: missingRule.ruleName,
                    passed: false,
                    result: 'NOT_EXTRACTED',
                    weightApplied: missingRule.weight,
                });
            }

        }

        // Keep the score within the specified 0–100 range.
        const riskScore = Math.min(totalRiskScore, 100);

        // Provisional verdict bands; confirm thresholds with the senior.
        const riskVerdict =
            riskScore >= 60
                ? 'HIGH_RISK'
                : riskScore >= 30 || riskFlags.length > 0
                    ? 'MEDIUM_RISK'
                    : 'LOW_RISK';

        const hasMismatch = comparison.some(
            (item) => item.result === 'MISMATCH',
        );


        const authenticityStatus = isSyntheticTestDocument
            ? 'SYNTHETIC_TEST_DOCUMENT'
            : 'NOT_INDEPENDENTLY_VERIFIED';

        const assessmentStatus = isSyntheticTestDocument
            ? 'BLOCKED'
            : riskFlags.length > 0
                ? 'MANUAL_REVIEW'
                : 'CLEAR';


        const rcBookStatus =
            riskVerdict === 'HIGH_RISK'
                ? 'HIGH_RISK'
                : 'NEEDS_VERIFICATION';


        // Save verification and update vehicle status atomically.
        const verification = await this.prisma.$transaction(
            async (tx) => {
                const savedVerification =
                    await tx.rcBookVerification.create({
                        data: {
                            vehicleId,
                            extractedFields: JSON.parse(
                                JSON.stringify(extractedFields),
                            ),
                            checkResults: JSON.parse(
                                JSON.stringify(checkResults),
                            ),
                            riskFlags: JSON.parse(
                                JSON.stringify(riskFlags),
                            ),
                            documentSnapshot: JSON.parse(
                                JSON.stringify(
                                    vehicle.documents.map((document) => ({
                                        documentId: document.id,
                                        documentType: document.documentType,
                                        version: document.version,
                                        fileHash: document.fileHash,
                                    })),
                                ),
                            ),
                            riskScore,
                            riskVerdict,
                            assessmentStatus,
                            authenticityStatus,
                            reviewStatus: 'PENDING',
                        },
                    });

                await tx.vehicle.update({
                    where: { id: vehicleId },
                    data: {
                        rcBookStatus,
                        hypothecationStatus,
                        financierName: financier,
                        hypothecationRemarks: hypothecationText || undefined,
                    },
                });

                return savedVerification;
            },
        );


        return {
            verificationId: verification.id,
            isOutdated: verification.isOutdated,
            documentSnapshot: verification.documentSnapshot,
            vehicleId,

            authenticityStatus,
            assessmentStatus,

            hypothecation: {
                status: hypothecationStatus,
                financierName: financier,
                manualReviewRequired: hypothecationNeedsReview,
            },

            documentCount: vehicle.documents.length,
            comparison,
            checkResults,
            flags: riskFlags,
            riskScore,
            riskVerdict,
            reviewStatus: verification.reviewStatus,
            verificationRequired: true,
            note: hasMismatch
                ? 'Inconsistencies detected. Manual verification is required.'
                : 'Checks completed. Document authenticity has not been independently established.',
        };
    }

    async getLatestVerification(vehicleId: string) {
        const verification = await this.prisma.rcBookVerification.findFirst({
            where: { vehicleId },
            orderBy: { createdAt: 'desc' },
        });

        if (!verification) {
            return null;
        }

        const vehicle = await this.prisma.vehicle.findUnique({
            where: { id: vehicleId },
        });

        if (!vehicle) {
            throw new NotFoundException('Vehicle not found');
        }

        const extractedFields = verification.extractedFields as {
            registrationNumber?: string | null;
            chassisNumber?: string | null;
            engineNumber?: string | null;
            vehicleColour?: string | null;
            hypothecationDetails?: string | null;
            financierName?: string | null;
        };

        const normalize = (value?: string | null) =>
            value?.replace(/\s+/g, '').toUpperCase() || null;

        const comparison = [
            {
                field: 'Registration Number',
                rcBookValue: extractedFields.registrationNumber ?? null,
                vehicleRecordValue: vehicle.registrationNumber ?? null,
            },
            {
                field: 'Chassis Number',
                rcBookValue: extractedFields.chassisNumber ?? null,
                vehicleRecordValue: vehicle.chassisNumber ?? null,
            },
            {
                field: 'Engine Number',
                rcBookValue: extractedFields.engineNumber ?? null,
                vehicleRecordValue: vehicle.engineNumber ?? null,
            },
            {
                field: 'Vehicle Colour',
                rcBookValue: extractedFields.vehicleColour ?? null,
                vehicleRecordValue: vehicle.colour ?? null,
            },
        ].map((item) => ({
            ...item,
            result: !normalize(item.rcBookValue) || !normalize(item.vehicleRecordValue)
                ? 'NOT_AVAILABLE'
                : normalize(item.rcBookValue) === normalize(item.vehicleRecordValue)
                    ? 'MATCH'
                    : 'MISMATCH',
        }));

        return {
            verificationId: verification.id,
            vehicleId: verification.vehicleId,
            extractedFields,
            comparison,
            checkResults: verification.checkResults,
            flags: verification.riskFlags,
            riskScore: verification.riskScore,
            riskVerdict: verification.riskVerdict,
            assessmentStatus: verification.assessmentStatus,
            authenticityStatus: verification.authenticityStatus,
            reviewStatus: verification.reviewStatus,
            reviewerName: verification.reviewerName,
            reviewRemarks: verification.reviewRemarks,
            reviewedAt: verification.reviewedAt,
            verificationRequired: true,
            note: 'Previously saved RC Book verification result.',
        };
    }

    async reviewVerification(
        vehicleId: string,
        verificationId: string,
        body: {
            reviewStatus: 'APPROVED' | 'REJECTED' | 'NEEDS_RESUBMISSION';
            reviewerName: string;
            reviewRemarks?: string;
        },
    ) {
        const allowedStatuses = [
            'APPROVED',
            'REJECTED',
            'NEEDS_RESUBMISSION',
        ];

        if (!allowedStatuses.includes(body.reviewStatus)) {
            throw new BadRequestException('Invalid review status');
        }

        if (!body.reviewerName?.trim()) {
            throw new BadRequestException('Reviewer name is required');
        }

        const verification =
            await this.prisma.rcBookVerification.findFirst({
                where: {
                    id: verificationId,
                    vehicleId,
                },
            });

        if (!verification) {
            throw new NotFoundException(
                'RC Book verification record not found',
            );
        }
        if (
            body.reviewStatus === 'APPROVED' &&
            (
                verification.assessmentStatus === 'BLOCKED' ||
                verification.authenticityStatus === 'SYNTHETIC_TEST_DOCUMENT'
            )
        ) {
            throw new BadRequestException(
                'This RC Book cannot be approved because the document is blocked or identified as synthetic test data.',
            );
        }

        if (verification.reviewStatus !== 'PENDING') {
            throw new BadRequestException(
                'This verification has already been reviewed',
            );
        }

        if (verification.isOutdated) {
            throw new BadRequestException(
                'This verification is outdated because an RC document was replaced. Please scan and verify the latest documents.',
            );
        }

        const vehicleStatus =
            body.reviewStatus === 'APPROVED'
                ? 'GENUINE'
                : body.reviewStatus === 'REJECTED'
                    ? 'HIGH_RISK'
                    : 'NEEDS_VERIFICATION';

        const result = await this.prisma.$transaction(async (tx) => {
            const updatedVerification =
                await tx.rcBookVerification.update({
                    where: { id: verificationId },
                    data: {
                        reviewStatus: body.reviewStatus,
                        reviewerName: body.reviewerName.trim(),
                        reviewRemarks: body.reviewRemarks?.trim() || null,
                        reviewedAt: new Date(),
                    },
                });

            await tx.vehicle.update({
                where: { id: vehicleId },
                data: {
                    rcBookStatus: vehicleStatus,
                },
            });

            return updatedVerification;
        });

        return {
            success: true,
            message: 'RC Book review completed successfully',
            data: result,
        };
    }
}
