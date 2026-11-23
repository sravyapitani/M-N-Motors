import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    const firstName = process.env.BOOTSTRAP_ADMIN_FIRST_NAME;
    const lastName = process.env.BOOTSTRAP_ADMIN_LAST_NAME;
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

    if (!email || !firstName || !lastName || !password || password.length < 12) {
        throw new Error(
            'Enter the admin email, name, and a password of at least 12 characters.',
        );
    }

    const prisma = new PrismaService();

    try {
        await prisma.$connect();

        if (await prisma.user.findUnique({ where: { email } })) {
            console.log(`Admin account for ${email} already exists.`);
            return;
        }

        const role = await prisma.role.upsert({
            where: { key: 'SYSTEM_ADMIN' },
            update: {},
            create: {
                key: 'SYSTEM_ADMIN',
                name: 'System Administrator',
                description: 'Initial administrator for local setup',
            },
        });

        await prisma.user.create({
            data: {
                email,
                firstName,
                lastName,
                passwordHash: await bcrypt.hash(password, 12),
                roles: {
                    create: {
                        role: { connect: { id: role.id } },
                    },
                },
            },
        });

        console.log(`Created the initial admin account for ${email}.`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});