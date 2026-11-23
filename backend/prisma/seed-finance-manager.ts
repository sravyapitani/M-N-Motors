import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
    const prisma = new PrismaService();

    try {
        await prisma.$connect();
        console.log('Connected to database. Seeding Finance Manager role and permissions...');

        // 1. Idempotently upsert permissions
        const loanApprovePermission = await prisma.permission.upsert({
            where: { key: 'LOAN_APPROVE' },
            update: {
                description: 'Permission to review, approve, and sanction vehicle loan applications',
            },
            create: {
                key: 'LOAN_APPROVE',
                description: 'Permission to review, approve, and sanction vehicle loan applications',
            },
        });
        console.log(`Permission ensured: ${loanApprovePermission.key} (${loanApprovePermission.id})`);

        const loanDisbursePermission = await prisma.permission.upsert({
            where: { key: 'LOAN_DISBURSE' },
            update: {
                description: 'Permission to authorize and disburse sanctioned loan funds to dealership',
            },
            create: {
                key: 'LOAN_DISBURSE',
                description: 'Permission to authorize and disburse sanctioned loan funds to dealership',
            },
        });
        console.log(`Permission ensured: ${loanDisbursePermission.key} (${loanDisbursePermission.id})`);

        // 2. Idempotently upsert FINANCE_MANAGER role
        const financeManagerRole = await prisma.role.upsert({
            where: { key: 'FINANCE_MANAGER' },
            update: {
                name: 'Finance Manager',
                description: 'Dealership Finance Manager authorized to approve, sanction, and disburse vehicle loans',
            },
            create: {
                key: 'FINANCE_MANAGER',
                name: 'Finance Manager',
                description: 'Dealership Finance Manager authorized to approve, sanction, and disburse vehicle loans',
            },
        });
        console.log(`Role ensured: ${financeManagerRole.key} (${financeManagerRole.id})`);

        // 3. Idempotently link permissions to FINANCE_MANAGER role
        await prisma.rolePermission.upsert({
            where: {
                roleId_permissionId: {
                    roleId: financeManagerRole.id,
                    permissionId: loanApprovePermission.id,
                },
            },
            update: {},
            create: {
                roleId: financeManagerRole.id,
                permissionId: loanApprovePermission.id,
            },
        });

        await prisma.rolePermission.upsert({
            where: {
                roleId_permissionId: {
                    roleId: financeManagerRole.id,
                    permissionId: loanDisbursePermission.id,
                },
            },
            update: {},
            create: {
                roleId: financeManagerRole.id,
                permissionId: loanDisbursePermission.id,
            },
        });

        console.log(
            `Successfully linked permissions [${loanApprovePermission.key}, ${loanDisbursePermission.key}] to role ${financeManagerRole.key}.`,
        );
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error: unknown) => {
    console.error('Failed to seed finance manager permissions:', error);
    process.exitCode = 1;
});

