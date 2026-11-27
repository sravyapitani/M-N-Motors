import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { PrismaService } from '../src/prisma/prisma.service';

interface FacilityInput {
    facilityKey: string;
    bankName: string;
    productCode: string;
    facilityType?: 'CC' | 'INVENTORY' | 'OTHER';
    sanctionedLimit: number | string;
    roiPercent?: number | string | null;
    graceDays?: number | null;
    isActive?: boolean;
}

async function main() {
    const isConfirm = process.argv.includes('--confirm');
    const localPath = path.resolve(__dirname, 'funding-facilities.local');
    const templatePath = path.resolve(__dirname, 'funding-facilities.template.json');

    const filePath = fs.existsSync(localPath) ? localPath : templatePath;
    const isUsingLocal = filePath === localPath;

    console.log('----------------------------------------------------');
    console.log(`Loading facilities from: ${path.basename(filePath)} ${isUsingLocal ? '(real local file)' : '(template fallback)'}`);
    console.log(`Mode: ${isConfirm ? 'EXECUTION (--confirm)' : 'DRY-RUN (read-only)'}`);
    console.log('----------------------------------------------------');

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    const rawData = fs.readFileSync(filePath, 'utf-8');
    let facilities: FacilityInput[];
    try {
        facilities = JSON.parse(rawData);
    } catch (err) {
        console.error('Failed to parse JSON file:', err);
        process.exit(1);
    }

    if (!Array.isArray(facilities) || facilities.length === 0) {
        console.error('Invalid facility data: expected non-empty JSON array.');
        process.exit(1);
    }

    const prisma = new PrismaService();
    try {
        await prisma.$connect();

        // Fetch lenders to attempt automatic linkage
        const lenders = await prisma.lender.findMany({ select: { id: true, name: true } });

        console.log(`Found ${facilities.length} facility entries to process:\n`);

        for (const item of facilities) {
            const limitNum = Number(item.sanctionedLimit);
            const roiNum = item.roiPercent != null ? Number(item.roiPercent) : null;
            const grace = item.graceDays != null ? Number(item.graceDays) : null;

            // Find matching lender
            const matchedLender = lenders.find(
                (l) => l.name.trim().toLowerCase() === item.bankName.trim().toLowerCase(),
            );

            console.log(`- [${item.facilityKey}] ${item.bankName} | Code: ${item.productCode} | Limit: ₹${limitNum.toLocaleString('en-IN')} | ROI: ${roiNum != null ? `${roiNum}%` : 'Not set'} | Grace: ${grace != null ? `${grace}d` : '60d (default)'}${matchedLender ? ` (Linked to Lender: ${matchedLender.name})` : ''}`);
        }

        if (!isConfirm) {
            console.log('\n[DRY RUN COMPLETE] No records were created or modified.');
            console.log('To apply these records to the database, run:');
            console.log('npx ts-node prisma/load-funding-facilities.ts --confirm\n');
            return;
        }

        // Execute upsert in transaction
        await prisma.$transaction(async (tx) => {
            let createdCount = 0;
            let updatedCount = 0;

            for (const item of facilities) {
                const limitNum = Number(item.sanctionedLimit);
                const roiNum = item.roiPercent != null ? Number(item.roiPercent) : null;
                const grace = item.graceDays != null ? Number(item.graceDays) : null;
                const matchedLender = lenders.find(
                    (l) => l.name.trim().toLowerCase() === item.bankName.trim().toLowerCase(),
                );

                const existing = await tx.fundingFacility.findUnique({
                    where: { facilityKey: item.facilityKey },
                });

                if (existing) {
                    await tx.fundingFacility.update({
                        where: { facilityKey: item.facilityKey },
                        data: {
                            bankName: item.bankName.trim(),
                            productCode: item.productCode.trim(),
                            facilityType: item.facilityType || 'INVENTORY',
                            sanctionedLimit: limitNum,
                            roiPercent: roiNum,
                            graceDays: grace,
                            isActive: item.isActive !== undefined ? item.isActive : true,
                            lenderId: matchedLender ? matchedLender.id : undefined,
                        },
                    });
                    updatedCount++;
                } else {
                    await tx.fundingFacility.create({
                        data: {
                            facilityKey: item.facilityKey.trim(),
                            bankName: item.bankName.trim(),
                            productCode: item.productCode.trim(),
                            facilityType: item.facilityType || 'INVENTORY',
                            sanctionedLimit: limitNum,
                            roiPercent: roiNum,
                            graceDays: grace,
                            isActive: item.isActive !== undefined ? item.isActive : true,
                            lenderId: matchedLender ? matchedLender.id : undefined,
                        },
                    });
                    createdCount++;
                }
            }

            console.log(`\nSuccessfully applied: ${createdCount} created, ${updatedCount} updated.`);
        });
    } catch (err) {
        console.error('Error loading facilities:', err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main();
}
