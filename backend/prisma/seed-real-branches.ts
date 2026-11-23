import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../src/prisma/prisma.service';

interface LocalBranchUser {
    firstName: string;
    lastName: string;
    email: string;
    branchCodes: string[];
    role?: string;
}

const REAL_BRANCHES = [
    { code: 'HO', name: 'Rajahmundry (Head Office)' },
    { code: 'KKD', name: 'Kakinada' },
    { code: 'TNK', name: 'Tanuku' },
    { code: 'NRP', name: 'Narasapuram' },
    { code: 'ELR', name: 'Eluru' },
];

async function main() {
    const jsonPath = path.resolve(__dirname, 'local-branch-users.json');
    if (!fs.existsSync(jsonPath)) {
        throw new Error(
            `local-branch-users.json is missing at "${jsonPath}". Please create it with firstName, lastName, email, branchCodes, and optional role before running this seed.`
        );
    }

    const rawJson = fs.readFileSync(jsonPath, 'utf-8');
    let usersData: LocalBranchUser[];
    try {
        const parsed = JSON.parse(rawJson);
        usersData = Array.isArray(parsed) ? parsed : parsed.users;
        if (!Array.isArray(usersData)) {
            throw new Error('JSON content must be an array or contain a "users" array.');
        }
    } catch (parseErr) {
        throw new Error(`Failed to parse local-branch-users.json: ${(parseErr as Error).message}`);
    }

    const temporaryPassword = process.env.BRANCH_USER_PASSWORD;
    if (!temporaryPassword || !temporaryPassword.trim()) {
        throw new Error(
            'BRANCH_USER_PASSWORD environment variable is missing or empty. Please set it before running this seed.'
        );
    }

    const prisma = new PrismaService();

    try {
        await prisma.$connect();
        console.log('Connected to database. Seeding real branches and users...');

        await prisma.$transaction(async (tx) => {
            // 1. Idempotently create/upsert branches
            const branchMap = new Map<string, string>(); // code -> id
            for (const b of REAL_BRANCHES) {
                const branch = await tx.branch.upsert({
                    where: { code: b.code },
                    update: { name: b.name, isActive: true },
                    create: {
                        code: b.code,
                        name: b.name,
                        isActive: true,
                    },
                });
                branchMap.set(branch.code, branch.id);
                console.log(`Branch ensured: ${branch.name} (${branch.code}) -> ${branch.id}`);
            }

            // 2. Hash temporary password once
            const passwordHash = await bcrypt.hash(temporaryPassword, 12);

            // 3. Ensure roles exist: FINANCE_MANAGER, BRANCH_HEAD, LOAN_OFFICER
            const financeManagerRole = await tx.role.upsert({
                where: { key: 'FINANCE_MANAGER' },
                update: {},
                create: {
                    key: 'FINANCE_MANAGER',
                    name: 'Finance Manager',
                    description: 'Finance Manager authorized to approve, sanction, and disburse vehicle loans',
                },
            });

            const branchHeadRole = await tx.role.upsert({
                where: { key: 'BRANCH_HEAD' },
                update: {},
                create: {
                    key: 'BRANCH_HEAD',
                    name: 'Branch Head',
                    description: 'Branch Head managing dealership branch operations, vehicle exchange, and loan desk',
                },
            });

            const loanOfficerRole = await tx.role.upsert({
                where: { key: 'LOAN_OFFICER' },
                update: {},
                create: {
                    key: 'LOAN_OFFICER',
                    name: 'Loan Officer',
                    description: 'Branch Loan Officer creating and submitting retail vehicle loan applications',
                },
            });

            const roleLookup: Record<string, string> = {
                FINANCE_MANAGER: financeManagerRole.id,
                BRANCH_HEAD: branchHeadRole.id,
                LOAN_OFFICER: loanOfficerRole.id,
            };

            // 4. Create or update users from local-branch-users.json
            for (const item of usersData) {
                const email = item.email.trim().toLowerCase();
                const firstName = item.firstName.trim();
                const lastName = item.lastName.trim();

                const user = await tx.user.upsert({
                    where: { email },
                    update: {
                        firstName,
                        lastName,
                        passwordHash,
                        isActive: true,
                    },
                    create: {
                        email,
                        firstName,
                        lastName,
                        passwordHash,
                        isActive: true,
                    },
                });

                console.log(`User ensured: ${firstName} ${lastName} <${email}> (${user.id})`);

                // Link User to designated branches
                for (const code of item.branchCodes) {
                    const branchId = branchMap.get(code.toUpperCase());
                    if (!branchId) {
                        throw new Error(`Invalid branchCode '${code}' for user ${email}. Available: ${Array.from(branchMap.keys()).join(', ')}`);
                    }

                    await tx.userBranch.upsert({
                        where: {
                            userId_branchId: {
                                userId: user.id,
                                branchId,
                            },
                        },
                        update: {},
                        create: {
                            userId: user.id,
                            branchId,
                        },
                    });
                }

                // Role handling:
                const targetRoleKey = item.role || (firstName.toLowerCase().includes('sanjeev') ? 'FINANCE_MANAGER' : undefined);
                if (targetRoleKey && roleLookup[targetRoleKey]) {
                    const roleId = roleLookup[targetRoleKey];
                    await tx.userRole.upsert({
                        where: {
                            userId_roleId: {
                                userId: user.id,
                                roleId,
                            },
                        },
                        update: {},
                        create: {
                            userId: user.id,
                            roleId,
                        },
                    });
                    console.log(`Assigned ${targetRoleKey} role to ${email}`);
                }
            }

            // 5. Link admin@nexus.local (SYSTEM_ADMIN) to all 5 real branches
            const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() || 'admin@nexus.local';
            const adminUser = await tx.user.findUnique({ where: { email: adminEmail } });
            if (adminUser) {
                for (const branchId of branchMap.values()) {
                    await tx.userBranch.upsert({
                        where: {
                            userId_branchId: {
                                userId: adminUser.id,
                                branchId,
                            },
                        },
                        update: {},
                        create: {
                            userId: adminUser.id,
                            branchId,
                        },
                    });
                }
                console.log(`Linked admin <${adminEmail}> to all ${branchMap.size} branches.`);
            }
        });

        console.log('Real branches and users seeded successfully.');
    } catch (err) {
        console.error('Seeding failed:', (err as Error).message);
        throw err;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

