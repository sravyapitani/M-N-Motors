
import 'dotenv/config';
import { PrismaService } from '../src/prisma/prisma.service';


const rcBookRules = [
    {
        ruleKey: 'REGISTRATION_MISMATCH',
        ruleName: 'Registration Number Mismatch',
        description: 'RC registration number differs from the vehicle record.',
        category: 'FIELD_CONSISTENCY',
        weight: 20,
        conditions: { check: 'REGISTRATION_NUMBER_MATCH' },
    },
    {
        ruleKey: 'CHASSIS_MISMATCH',
        ruleName: 'Chassis Number Mismatch',
        description: 'RC chassis number differs from the vehicle record.',
        category: 'FIELD_CONSISTENCY',
        weight: 35,
        conditions: { check: 'CHASSIS_NUMBER_MATCH' },
    },
    {
        ruleKey: 'ENGINE_MISMATCH',
        ruleName: 'Engine Number Mismatch',
        description: 'RC engine number differs from the vehicle record.',
        category: 'FIELD_CONSISTENCY',
        weight: 25,
        conditions: { check: 'ENGINE_NUMBER_MATCH' },
    },
    {
        ruleKey: 'COLOUR_MISMATCH',
        ruleName: 'Vehicle Colour Mismatch',
        description: 'RC vehicle colour differs from the vehicle record.',
        category: 'FIELD_CONSISTENCY',
        weight: 5,
        conditions: { check: 'VEHICLE_COLOUR_MATCH' },
    },
    {
        ruleKey: 'REGISTRATION_MISSING',
        ruleName: 'Registration Number Missing',
        description: 'Registration number could not be extracted.',
        category: 'OCR_COMPLETENESS',
        weight: 15,
        conditions: { check: 'REGISTRATION_NUMBER_PRESENT' },
    },
    {
        ruleKey: 'CHASSIS_MISSING',
        ruleName: 'Chassis Number Missing',
        description: 'Chassis number could not be extracted.',
        category: 'OCR_COMPLETENESS',
        weight: 15,
        conditions: { check: 'CHASSIS_NUMBER_PRESENT' },
    },
    {
        ruleKey: 'ENGINE_MISSING',
        ruleName: 'Engine Number Missing',
        description: 'Engine number could not be extracted.',
        category: 'OCR_COMPLETENESS',
        weight: 10,
        conditions: { check: 'ENGINE_NUMBER_PRESENT' },
    },
    {
        ruleKey: 'COLOUR_MISSING',
        ruleName: 'Vehicle Colour Missing',
        description: 'Vehicle colour could not be extracted.',
        category: 'OCR_COMPLETENESS',
        weight: 5,
        conditions: { check: 'VEHICLE_COLOUR_PRESENT' },
    },

    {
        ruleKey: 'HYPOTHECATION_INFORMATION_UNCLEAR',
        ruleName: 'Hypothecation Information Unclear',
        description: 'Hypothecation status cannot be reliably determined from the RC Book.',
        category: 'HYPOTHECATION',
        weight: 20,
        conditions: { check: 'HYPOTHECATION_STATUS_VERIFIABLE' },
    },

];


async function main() {
    const prisma = new PrismaService();

    try {
        await prisma.$connect();

        for (const rule of rcBookRules) {
            await prisma.rcBookRule.upsert({
                where: { ruleKey: rule.ruleKey },
                update: {
                    ruleName: rule.ruleName,
                    description: rule.description,
                    category: rule.category,
                    weight: rule.weight,
                    conditions: rule.conditions,
                    isActive: true,
                },
                create: rule,
            });
        }

        console.log(`Successfully seeded ${rcBookRules.length} RC Book rules.`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error: unknown) => {
    console.error('RC Book rule seeding failed:', error);
    process.exitCode = 1;
});
