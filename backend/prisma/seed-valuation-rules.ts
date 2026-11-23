
import 'dotenv/config';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';

const valuationRules = [
    {
        // Required by ExchangeVehiclesValuationService but was missing from this seed.
        // Default bands follow the IRDAI motor depreciation schedule; confirm with the business.
        ruleKey: 'AGE_DEPRECIATION',
        ruleName: 'Age Depreciation',
        description: 'Depreciation on base price by vehicle age in months since registration (above 5 years: negotiated).',
    },
    {
        ruleKey: 'MILEAGE_ADJUSTMENT',
        ruleName: 'Mileage Adjustment',
        description: 'Adjustment based on actual kilometres against expected annual usage.',
    },
    {
        ruleKey: 'CONDITION_ADJUSTMENT',
        ruleName: 'Condition Adjustment',
        description: 'Adjustment based on vehicle inspection condition score.',
    },
    {
        ruleKey: 'EXTRA_OWNER_DEDUCTION',
        ruleName: 'Extra Owner Deduction',
        description: 'Deduction for each previous owner after the first owner.',
    },
    {
        ruleKey: 'ACCIDENT_REPAINT_DEDUCTION',
        ruleName: 'Accident and Repaint Deduction',
        description: 'Deduction based on accident severity and repaint coverage.',
    },
    {
        ruleKey: 'SERVICE_HISTORY_PREMIUM',
        ruleName: 'Full Service History Premium',
        description: 'Premium for complete authorised workshop service records.',
    },
    {
        ruleKey: 'APPROVAL_DEVIATION_THRESHOLD',
        ruleName: 'Approval Deviation Threshold',
        description: 'Approval requirements based on evaluator quote deviation.',
    },
];

type Band = {
    bandKey: string;
    minValue: number | null;
    maxValue: number | null;
    ruleValue: number;
    unit: string;
    sortOrder: number;
    conditions?: Prisma.InputJsonValue;
};

const bandsByRule: Record<string, Band[]> = {
    // minValue/maxValue are age in months (max exclusive); ruleValue is % depreciation.
    AGE_DEPRECIATION: [
        { bandKey: 'UPTO_6_MONTHS', minValue: 0, maxValue: 6, ruleValue: 5, unit: 'PERCENT', sortOrder: 1 },
        { bandKey: '6_TO_12_MONTHS', minValue: 6, maxValue: 12, ruleValue: 15, unit: 'PERCENT', sortOrder: 2 },
        { bandKey: '1_TO_2_YEARS', minValue: 12, maxValue: 24, ruleValue: 20, unit: 'PERCENT', sortOrder: 3 },
        { bandKey: '2_TO_3_YEARS', minValue: 24, maxValue: 36, ruleValue: 30, unit: 'PERCENT', sortOrder: 4 },
        { bandKey: '3_TO_4_YEARS', minValue: 36, maxValue: 48, ruleValue: 40, unit: 'PERCENT', sortOrder: 5 },
        { bandKey: '4_TO_5_YEARS', minValue: 48, maxValue: 60, ruleValue: 50, unit: 'PERCENT', sortOrder: 6 },
        { bandKey: 'ABOVE_5_YEARS', minValue: 60, maxValue: null, ruleValue: 0, unit: 'NEGOTIATED', sortOrder: 7 },
    ],
    MILEAGE_ADJUSTMENT: [
        {
            bandKey: 'ABOVE_EXPECTED',
            minValue: 0,
            maxValue: null,
            ruleValue: -0.15,
            unit: 'PERCENT_PER_1000_KM',
            sortOrder: 1,
            conditions: {
                expectedAnnualKm: {
                    PETROL: 12000,
                    CNG: 12000,
                    EV: 12000,
                    DIESEL: 15000,
                    COMMERCIAL: 20000,
                    THREE_WHEELER: 20000,
                },
                maximumAdjustment: -15,
            },
        },
        {
            bandKey: 'BELOW_EXPECTED',
            minValue: 0,
            maxValue: null,
            ruleValue: 0.075,
            unit: 'PERCENT_PER_1000_KM',
            sortOrder: 2,
            conditions: { maximumAdjustment: 5 },
        },
    ],

    CONDITION_ADJUSTMENT: [
        { bandKey: 'EXCELLENT', minValue: 90, maxValue: 100, ruleValue: 2, unit: 'PERCENT', sortOrder: 1 },
        { bandKey: 'GOOD', minValue: 75, maxValue: 89, ruleValue: 0, unit: 'PERCENT', sortOrder: 2 },
        { bandKey: 'FAIR', minValue: 60, maxValue: 74, ruleValue: -5, unit: 'PERCENT', sortOrder: 3 },
        { bandKey: 'POOR', minValue: 40, maxValue: 59, ruleValue: -12, unit: 'PERCENT', sortOrder: 4 },
        { bandKey: 'VERY_POOR', minValue: 0, maxValue: 39, ruleValue: -20, unit: 'PERCENT', sortOrder: 5 },
    ],

    EXTRA_OWNER_DEDUCTION: [
        {
            bandKey: 'ADDITIONAL_OWNER',
            minValue: 1,
            maxValue: null,
            ruleValue: -3,
            unit: 'PERCENT_PER_OWNER',
            sortOrder: 1,
            conditions: { maximumDeduction: 12 },
        },
    ],

    ACCIDENT_REPAINT_DEDUCTION: [
        { bandKey: 'ACCIDENT_MINOR', minValue: null, maxValue: null, ruleValue: -3, unit: 'PERCENT', sortOrder: 1 },
        { bandKey: 'ACCIDENT_MODERATE', minValue: null, maxValue: null, ruleValue: -8, unit: 'PERCENT', sortOrder: 2 },
        { bandKey: 'ACCIDENT_MAJOR', minValue: null, maxValue: null, ruleValue: -15, unit: 'PERCENT', sortOrder: 3 },
        { bandKey: 'REPAINT_1_2_PANELS', minValue: null, maxValue: null, ruleValue: -1, unit: 'PERCENT', sortOrder: 4 },
        { bandKey: 'REPAINT_3_5_PANELS', minValue: null, maxValue: null, ruleValue: -2.5, unit: 'PERCENT', sortOrder: 5 },
        { bandKey: 'REPAINT_FULL_BODY', minValue: null, maxValue: null, ruleValue: -5, unit: 'PERCENT', sortOrder: 6 },
    ],

    SERVICE_HISTORY_PREMIUM: [
        { bandKey: 'COMPLETE_AUTHORISED', minValue: null, maxValue: null, ruleValue: 2, unit: 'PERCENT', sortOrder: 1 },
        { bandKey: 'PARTIAL_OR_MISSING', minValue: null, maxValue: null, ruleValue: 0, unit: 'PERCENT', sortOrder: 2 },
    ],

    APPROVAL_DEVIATION_THRESHOLD: [
        {
            bandKey: 'AUTO_ACCEPT',
            minValue: 0,
            maxValue: 5,
            ruleValue: 5,
            unit: 'PERCENT_DEVIATION',
            sortOrder: 1,
        },
        {
            bandKey: 'REASON_REQUIRED',
            minValue: 5.01,
            maxValue: 10,
            ruleValue: 10,
            unit: 'PERCENT_DEVIATION',
            sortOrder: 2,
        },
        {
            bandKey: 'MANAGER_APPROVAL',
            minValue: 10.01,
            maxValue: null,
            ruleValue: 10,
            unit: 'PERCENT_DEVIATION',
            sortOrder: 3,
        },
    ],
};

async function main() {
    const prisma = new PrismaService();

    try {
        await prisma.$connect();

        for (const rule of valuationRules) {
            const savedRule = await prisma.valuationRule.upsert({
                where: { ruleKey: rule.ruleKey },
                update: {
                    ruleName: rule.ruleName,
                    description: rule.description,
                    isActive: true,
                },
                create: {
                    ...rule,
                    isActive: true,
                },
            });

            for (const band of bandsByRule[rule.ruleKey]) {
                await prisma.valuationRuleBand.upsert({
                    where: {
                        ruleId_bandKey: {
                            ruleId: savedRule.id,
                            bandKey: band.bandKey,
                        },
                    },
                    update: {
                        minValue: band.minValue,
                        maxValue: band.maxValue,
                        ruleValue: band.ruleValue,
                        unit: band.unit,
                        sortOrder: band.sortOrder,
                        conditions: band.conditions ?? Prisma.JsonNull,
                    },
                    create: {
                        ruleId: savedRule.id,
                        ...band,
                        conditions: band.conditions ?? Prisma.JsonNull,
                    },
                });
            }
        }

        console.log('Valuation rules and bands seeded successfully.');
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error: unknown) => {
    console.error('Valuation rule seeding failed:', error);
    process.exitCode = 1;
});
