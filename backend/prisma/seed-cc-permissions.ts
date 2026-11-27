import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Idempotent seed script to add CC_VIEW and CC_MANAGE permissions
 * and assign them to FINANCE_MANAGER and FINANCE_EXECUTIVE roles.
 */
async function main() {
    const prisma = new PrismaService();

    try {
        await prisma.$connect();
        console.log('Connected to database. Seeding CC / stock-funding permissions (CC_VIEW, CC_MANAGE)...');

        // 1. Idempotently upsert CC_VIEW permission
        const ccViewPermission = await prisma.permission.upsert({
            where: { key: 'CC_VIEW' },
            update: {
                description: 'Permission to view CC and inventory/stock-funding facilities, draws, repayments, and alerts',
            },
            create: {
                key: 'CC_VIEW',
                description: 'Permission to view CC and inventory/stock-funding facilities, draws, repayments, and alerts',
            },
        });
        console.log(`Permission ensured: ${ccViewPermission.key} (${ccViewPermission.id})`);

        // 2. Idempotently upsert CC_MANAGE permission
        const ccManagePermission = await prisma.permission.upsert({
            where: { key: 'CC_MANAGE' },
            update: {
                description: 'Permission to create/edit CC and inventory-funding draws and record repayments',
            },
            create: {
                key: 'CC_MANAGE',
                description: 'Permission to create/edit CC and inventory-funding draws and record repayments',
            },
        });
        console.log(`Permission ensured: ${ccManagePermission.key} (${ccManagePermission.id})`);

        // 3. Find roles
        const rolesToView = ['FINANCE_MANAGER', 'FINANCE_EXECUTIVE'];
        const roles = await prisma.role.findMany({
            where: { key: { in: rolesToView } },
        });

        // 4. Link CC_VIEW to FINANCE_MANAGER and FINANCE_EXECUTIVE
        for (const role of roles) {
            await prisma.rolePermission.upsert({
                where: {
                    roleId_permissionId: {
                        roleId: role.id,
                        permissionId: ccViewPermission.id,
                    },
                },
                update: {},
                create: {
                    roleId: role.id,
                    permissionId: ccViewPermission.id,
                },
            });
            console.log(`Linked ${ccViewPermission.key} to ${role.key} (${role.name})`);
        }

        // 5. Link CC_MANAGE strictly to FINANCE_MANAGER
        const financeManagerRole = roles.find((r) => r.key === 'FINANCE_MANAGER');
        if (financeManagerRole) {
            await prisma.rolePermission.upsert({
                where: {
                    roleId_permissionId: {
                        roleId: financeManagerRole.id,
                        permissionId: ccManagePermission.id,
                    },
                },
                update: {},
                create: {
                    roleId: financeManagerRole.id,
                    permissionId: ccManagePermission.id,
                },
            });
            console.log(`Linked ${ccManagePermission.key} to ${financeManagerRole.name}`);
        }

        console.log('CC / funding permissions seeded successfully.');
    } catch (error) {
        console.error('Failed to seed CC permissions:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main();
}
