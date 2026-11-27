import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
    const prisma = new PrismaService();

    try {
        await prisma.$connect();
        console.log('Connected to database. Seeding payout permissions (PAYOUT_MANAGE, PAYOUT_VIEW)...');

        // 1. Idempotently upsert PAYOUT_MANAGE permission
        const payoutManagePermission = await prisma.permission.upsert({
            where: { key: 'PAYOUT_MANAGE' },
            update: {
                description: 'Permission to record lender payout receipts and edit payout terms',
            },
            create: {
                key: 'PAYOUT_MANAGE',
                description: 'Permission to record lender payout receipts and edit payout terms',
            },
        });
        console.log(`Permission ensured: ${payoutManagePermission.key} (${payoutManagePermission.id})`);

        // 2. Idempotently upsert PAYOUT_VIEW permission
        const payoutViewPermission = await prisma.permission.upsert({
            where: { key: 'PAYOUT_VIEW' },
            update: {
                description: 'Permission to view financer payouts and payout alerts',
            },
            create: {
                key: 'PAYOUT_VIEW',
                description: 'Permission to view financer payouts and payout alerts',
            },
        });
        console.log(`Permission ensured: ${payoutViewPermission.key} (${payoutViewPermission.id})`);

        // 3. Find roles
        const rolesToView = ['FINANCE_MANAGER', 'FINANCE_EXECUTIVE', 'BRANCH_HEAD', 'LOAN_OFFICER'];
        const roles = await prisma.role.findMany({
            where: { key: { in: rolesToView } },
        });

        // 4. Idempotently link PAYOUT_VIEW to all 4 roles
        for (const role of roles) {
            await prisma.rolePermission.upsert({
                where: {
                    roleId_permissionId: {
                        roleId: role.id,
                        permissionId: payoutViewPermission.id,
                    },
                },
                update: {},
                create: {
                    roleId: role.id,
                    permissionId: payoutViewPermission.id,
                },
            });
            console.log(`Linked ${payoutViewPermission.key} to ${role.key} (${role.name})`);
        }

        // 5. Idempotently link PAYOUT_MANAGE to FINANCE_MANAGER
        const financeManagerRole = roles.find((r) => r.key === 'FINANCE_MANAGER');
        if (financeManagerRole) {
            await prisma.rolePermission.upsert({
                where: {
                    roleId_permissionId: {
                        roleId: financeManagerRole.id,
                        permissionId: payoutManagePermission.id,
                    },
                },
                update: {},
                create: {
                    roleId: financeManagerRole.id,
                    permissionId: payoutManagePermission.id,
                },
            });
            console.log(`Linked ${payoutManagePermission.key} to ${financeManagerRole.name}`);
        }
    } catch (error) {
        console.error('Failed to seed payout permissions:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main();
}
