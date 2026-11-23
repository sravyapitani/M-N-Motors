/**
 * Seeds the employee demo accounts that the old "Nexus-ERP-Project-Share" login screen
 * had hardcoded in the frontend, as real database users with matching roles.
 *
 * Local development only. Idempotent: re-running updates names/roles/passwords in place.
 * Run after seed-finance-manager.ts and seed-real-branches.ts (needs the FINANCE_MANAGER
 * role and the branches to exist).
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../src/prisma/prisma.service';
import { Department } from '../src/generated/prisma/enums';

const ROLES = [
    { key: 'SYSTEM_ADMIN', name: 'System Administrator', description: 'Full access to every module and branch' },
    { key: 'FINANCE_MANAGER', name: 'Finance Manager', description: 'Finance & Loan Desk manager: can sanction and disburse loans' },
    { key: 'FINANCE_EXECUTIVE', name: 'Finance Executive', description: 'Creates and progresses loan applications; cannot sanction or disburse' },
    { key: 'HR_MANAGER', name: 'HR Manager', description: 'HR & Payroll module' },
    { key: 'USED_VEHICLES_EXECUTIVE', name: 'Used Vehicles Executive', description: 'Exchange / Used Vehicles module' },
    { key: 'COMPLIANCE_OFFICER', name: 'Compliance Officer', description: 'TDS / TCS compliance module' },
];

// Same emails, names and passwords as the old demo login screen.
const EMPLOYEES: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    role: string;
    department: Department | null;
}[] = [
    { email: 'admin@nexuserp.demo', firstName: 'Suresh', lastName: 'Achanta', password: 'Admin@123', role: 'SYSTEM_ADMIN', department: null },
    { email: 'finance.manager@nexuserp.demo', firstName: 'Neha', lastName: 'Kulkarni', password: 'Finance@123', role: 'FINANCE_MANAGER', department: Department.FINANCE },
    { email: 'finance.executive@nexuserp.demo', firstName: 'Rohan', lastName: 'Patil', password: 'Executive@123', role: 'FINANCE_EXECUTIVE', department: Department.FINANCE },
    { email: 'hr.manager@nexuserp.demo', firstName: 'Pooja', lastName: 'Joshi', password: 'HR@123', role: 'HR_MANAGER', department: Department.HR },
    { email: 'vehicles@nexuserp.demo', firstName: 'Kunal', lastName: 'Shah', password: 'Vehicles@123', role: 'USED_VEHICLES_EXECUTIVE', department: Department.EXCHANGE },
    { email: 'compliance@nexuserp.demo', firstName: 'Riya', lastName: 'Desai', password: 'Compliance@123', role: 'COMPLIANCE_OFFICER', department: null },
];

async function main() {
    const prisma = new PrismaService();
    try {
        await prisma.$connect();

        const roleIds = new Map<string, string>();
        for (const r of ROLES) {
            const role = await prisma.role.upsert({
                where: { key: r.key },
                update: {},
                create: r,
            });
            roleIds.set(r.key, role.id);
        }

        const branches = await prisma.branch.findMany({ where: { isActive: true } });
        if (branches.length === 0) {
            throw new Error('No active branches found. Run prisma/seed-real-branches.ts first.');
        }

        for (const e of EMPLOYEES) {
            const passwordHash = await bcrypt.hash(e.password, 12);
            const user = await prisma.user.upsert({
                where: { email: e.email },
                update: { firstName: e.firstName, lastName: e.lastName, department: e.department, passwordHash, isActive: true },
                create: { email: e.email, firstName: e.firstName, lastName: e.lastName, department: e.department, passwordHash },
            });

            // Exactly one role, matching the old demo login.
            await prisma.userRole.deleteMany({ where: { userId: user.id } });
            await prisma.userRole.create({ data: { userId: user.id, roleId: roleIds.get(e.role)! } });

            // All branches, like the old demo's "All Branches" view.
            for (const b of branches) {
                await prisma.userBranch.upsert({
                    where: { userId_branchId: { userId: user.id, branchId: b.id } },
                    update: {},
                    create: { userId: user.id, branchId: b.id },
                });
            }
            console.log(`Employee ensured: ${e.firstName} ${e.lastName} <${e.email}> as ${e.role}`);
        }
        console.log(`Seeded ${EMPLOYEES.length} employee accounts across ${branches.length} branches.`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error('Seeding failed:', (err as Error).message);
    process.exit(1);
});
