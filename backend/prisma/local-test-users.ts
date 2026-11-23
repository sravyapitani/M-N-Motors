import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
    const officerPassword = process.env.OFFICER_PASSWORD?.trim();
    const fmPassword = process.env.FM_PASSWORD?.trim();

    if (!officerPassword || !fmPassword) {
        throw new Error(
            'Both OFFICER_PASSWORD and FM_PASSWORD environment variables must be set.',
        );
    }

    const prisma = new PrismaService();

    try {
        await prisma.$connect();

        // 1. Ensure branch-mumbai-1 exists
        const branch = await prisma.branch.upsert({
            where: { id: 'branch-mumbai-1' },
            update: {
                name: 'M&N Motors',
            },
            create: {
                id: 'branch-mumbai-1',
                code: 'MUM-01',
                name: 'M&N Motors',
                isActive: true,
            },
        });

        // 2. Ensure FINANCE_MANAGER role exists (Role uses 'key')
        const financeManagerRole = await prisma.role.findUnique({
            where: { key: 'FINANCE_MANAGER' },
        });

        if (!financeManagerRole) {
            throw new Error(
                'Role FINANCE_MANAGER not found. Please run seed-finance-manager first.',
            );
        }

        // 3. Create/update officer@nexus.local (no roles, User uses 'isActive')
        const officerEmail = 'officer@nexus.local';
        const officerHash = await bcrypt.hash(officerPassword, 12);
        const officerUser = await prisma.user.upsert({
            where: { email: officerEmail },
            update: {
                passwordHash: officerHash,
                isActive: true,
            },
            create: {
                email: officerEmail,
                firstName: 'Loan',
                lastName: 'Officer',
                passwordHash: officerHash,
                isActive: true,
            },
        });

        await prisma.userBranch.upsert({
            where: {
                userId_branchId: {
                    userId: officerUser.id,
                    branchId: branch.id,
                },
            },
            update: {},
            create: {
                userId: officerUser.id,
                branchId: branch.id,
            },
        });

        // Ensure officer has no roles
        await prisma.userRole.deleteMany({
            where: { userId: officerUser.id },
        });

        console.log(`Configured ${officerEmail} with branch access to ${branch.id} (no roles assigned).`);

        // 4. Create/update financemanager@nexus.local (role FINANCE_MANAGER, User uses 'isActive')
        const fmEmail = 'financemanager@nexus.local';
        const fmHash = await bcrypt.hash(fmPassword, 12);
        const fmUser = await prisma.user.upsert({
            where: { email: fmEmail },
            update: {
                passwordHash: fmHash,
                isActive: true,
            },
            create: {
                email: fmEmail,
                firstName: 'Finance',
                lastName: 'Manager',
                passwordHash: fmHash,
                isActive: true,
            },
        });

        await prisma.userBranch.upsert({
            where: {
                userId_branchId: {
                    userId: fmUser.id,
                    branchId: branch.id,
                },
            },
            update: {},
            create: {
                userId: fmUser.id,
                branchId: branch.id,
            },
        });

        await prisma.userRole.upsert({
            where: {
                userId_roleId: {
                    userId: fmUser.id,
                    roleId: financeManagerRole.id,
                },
            },
            update: {},
            create: {
                userId: fmUser.id,
                roleId: financeManagerRole.id,
            },
        });

        console.log(`Configured ${fmEmail} with role FINANCE_MANAGER in branch ${branch.id}.`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});

