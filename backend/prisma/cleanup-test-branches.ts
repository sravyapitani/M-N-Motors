import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
    const prisma = new PrismaService();

    try {
        await prisma.$connect();
        console.log('Connected to database. Starting cleanup of test branch and attached test data...');

        await prisma.$transaction(async (tx) => {
            // Find MUM-01 branch
            const testBranch = await tx.branch.findFirst({
                where: {
                    OR: [
                        { code: 'MUM-01' },
                        { id: 'branch-mumbai-1' },
                    ],
                },
            });

            if (!testBranch) {
                console.log('Test branch MUM-01 / branch-mumbai-1 not found. Cleanup already completed or not needed.');
                return;
            }

            console.log(`Found test branch: ${testBranch.name} (${testBranch.code}, id: ${testBranch.id})`);

            // 1. Delete journal entries and their lines attached to this branch or test loans
            const testJournalEntries = await tx.journalEntry.findMany({
                where: {
                    OR: [
                        { branchId: testBranch.id },
                        { entryNumber: 'JE-20261112-0001' },
                    ],
                },
                select: { id: true, entryNumber: true },
            });

            for (const je of testJournalEntries) {
                // Delete lines explicitly first (or cascade)
                const deletedLines = await tx.journalLine.deleteMany({
                    where: { journalEntryId: je.id },
                });
                console.log(`Deleted ${deletedLines.count} journal lines for entry ${je.entryNumber} (${je.id})`);

                await tx.journalEntry.delete({
                    where: { id: je.id },
                });
                console.log(`Deleted journal entry ${je.entryNumber} (${je.id})`);
            }

            // 2. Delete loan applications belonging to the test branch
            const deletedLoans = await tx.loanApplication.deleteMany({
                where: { branchId: testBranch.id },
            });
            console.log(`Deleted ${deletedLoans.count} loan applications belonging to branch ${testBranch.code}`);

            // 3. UserBranch links for officer@nexus.local and financemanager@nexus.local (and test branch unlinking)
            const testEmails = ['officer@nexus.local', 'financemanager@nexus.local'];
            const testUsers = await tx.user.findMany({
                where: { email: { in: testEmails } },
                select: { id: true, email: true },
            });

            const testUserIds = testUsers.map((u) => u.id);

            // Delete UserBranch records for test branch or test users
            const deletedUserBranches = await tx.userBranch.deleteMany({
                where: {
                    OR: [
                        { branchId: testBranch.id },
                        { userId: { in: testUserIds } },
                    ],
                },
            });
            console.log(`Deleted ${deletedUserBranches.count} UserBranch links`);

            // 4. Delete UserRole records for test users
            if (testUserIds.length > 0) {
                const deletedUserRoles = await tx.userRole.deleteMany({
                    where: { userId: { in: testUserIds } },
                });
                console.log(`Deleted ${deletedUserRoles.count} UserRole links for test users`);

                // Delete test users themselves
                const deletedUsers = await tx.user.deleteMany({
                    where: { id: { in: testUserIds } },
                });
                console.log(`Deleted ${deletedUsers.count} test users (officer@nexus.local, financemanager@nexus.local)`);
            }

            // 5. Delete the test branch itself
            await tx.branch.delete({
                where: { id: testBranch.id },
            });
            console.log(`Deleted test branch ${testBranch.code} (${testBranch.id})`);

            // 6. Ensure admin@nexus.local is linked to all remaining active branches
            const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() || 'admin@nexus.local';
            const adminUser = await tx.user.findUnique({ where: { email: adminEmail } });
            if (adminUser) {
                const activeBranches = await tx.branch.findMany({
                    where: { isActive: true },
                });
                for (const b of activeBranches) {
                    await tx.userBranch.upsert({
                        where: {
                            userId_branchId: {
                                userId: adminUser.id,
                                branchId: b.id,
                            },
                        },
                        update: {},
                        create: {
                            userId: adminUser.id,
                            branchId: b.id,
                        },
                    });
                }
                console.log(`Ensured admin <${adminEmail}> is linked to all ${activeBranches.length} active branches.`);
            }
        });

        console.log('Cleanup transaction committed successfully.');
    } catch (err) {
        console.error('Cleanup failed and rolled back:', (err as Error).message);
        throw err;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

