import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { PrismaService } from '../src/prisma/prisma.service';
import { LoanStatus } from '../src/generated/prisma/enums';

const SEED_LOANS = [
    {
        id: 'cmwa954v300019ois5f113q2e',
        customerName: 'Rahul Sharma',
        lenderName: 'HDFC Bank',
        loanAmount: 75001.00,
        interestRate: 9.50,
        tenureMonths: 48,
        commissionAmount: 1500.02,
        status: LoanStatus.SUBMITTED,
        branchCode: 'KKD',
        submittingEmail: 'bharathi.kkd@nexus.local',
    },
    {
        id: 'cmwdivrxe00008oisoptgr5cu',
        customerName: 'Prasad Gubbala',
        lenderName: 'ICICI Bank',
        loanAmount: 500000.00,
        interestRate: 9.50,
        tenureMonths: 48,
        commissionAmount: 10000.00,
        status: LoanStatus.DISBURSED,
        branchCode: 'KKD',
        submittingEmail: 'bharathi.kkd@nexus.local',
    },
    {
        id: 'cmwa8c0rv00009oisjfl60stt',
        customerName: 'Ayesha Rao',
        lenderName: 'HDFC Bank',
        loanAmount: 650000.00,
        interestRate: 8.75,
        tenureMonths: 48,
        commissionAmount: 13000.00,
        status: LoanStatus.DISBURSED,
        branchCode: 'TNK',
        submittingEmail: 'dharshan.tnk@nexus.local',
    },
    {
        id: 'cmwamr8cn00008oisf5m86ril',
        customerName: 'Teja Surapuneni',
        lenderName: 'HDFC Bank',
        loanAmount: 100000.00,
        interestRate: 9.50,
        tenureMonths: 48,
        commissionAmount: 2000.00,
        status: LoanStatus.REJECTED,
        branchCode: 'NRP',
        submittingEmail: 'suresh.nrp@nexus.local',
    },
    {
        id: 'cmwdjpr5n0000ywisboya3d6r',
        customerName: 'Surya Teja Bunga',
        lenderName: 'State Bank of India',
        loanAmount: 500000.00,
        interestRate: 9.50,
        tenureMonths: 48,
        commissionAmount: 10000.00,
        status: LoanStatus.DISBURSED,
        branchCode: 'ELR',
        submittingEmail: 'swathi.elr@nexus.local',
    },
    {
        id: 'cmwbqnsvn0000wcisrwx0jm4g',
        customerName: 'Navya Molleti',
        lenderName: 'AU Small Finance Bank',
        loanAmount: 200000.00,
        interestRate: 9.50,
        tenureMonths: 48,
        commissionAmount: 4000.00,
        status: LoanStatus.SUBMITTED,
        branchCode: 'ELR',
        submittingEmail: 'rahul.elr@nexus.local',
    },
    {
        id: 'cmwabqim70000hwissudfwkok',
        customerName: 'Sravya Pitani',
        lenderName: 'State Bank of India',
        loanAmount: 100001.00,
        interestRate: 9.50,
        tenureMonths: 48,
        commissionAmount: 2000.02,
        status: LoanStatus.DISBURSED,
        branchCode: 'HO',
        submittingEmail: 'admin@nexus.local',
    },
];

async function main() {
    const prisma = new PrismaService();
    try {
        await prisma.$connect();
        console.log('Connected to database. Seeding real loan applications...');

        // Remove test customer if exists
        await prisma.loanApplication.deleteMany({
            where: { customerName: 'Test Customer' },
        });

        const branches = await prisma.branch.findMany();
        const branchMap = new Map(branches.map((b) => [b.code, b.id]));

        const lenders = await prisma.lender.findMany();
        const lenderMap = new Map(lenders.map((l) => [l.name, l.id]));

        const users = await prisma.user.findMany();
        const userMap = new Map(users.map((u) => [u.email, u.id]));
        const adminId = userMap.get('admin@nexus.local') || users[0]?.id;

        for (const item of SEED_LOANS) {
            const branchId = branchMap.get(item.branchCode);
            if (!branchId) {
                console.warn(`Branch code ${item.branchCode} not found, skipping loan ${item.customerName}`);
                continue;
            }

            const submittingUserId = userMap.get(item.submittingEmail) || adminId;
            const lenderId = lenderMap.get(item.lenderName);

            await prisma.loanApplication.upsert({
                where: { id: item.id },
                update: {
                    customerName: item.customerName,
                    lenderName: item.lenderName,
                    lenderId,
                    loanAmount: item.loanAmount,
                    interestRate: item.interestRate,
                    tenureMonths: item.tenureMonths,
                    commissionAmount: item.commissionAmount,
                    status: item.status,
                    branchId,
                    submittingUserId,
                },
                create: {
                    id: item.id,
                    customerName: item.customerName,
                    lenderName: item.lenderName,
                    lenderId,
                    loanAmount: item.loanAmount,
                    interestRate: item.interestRate,
                    tenureMonths: item.tenureMonths,
                    commissionAmount: item.commissionAmount,
                    status: item.status,
                    branchId,
                    submittingUserId,
                },
            });
            console.log(`Loan application ensured: ${item.customerName} (${item.lenderName}, ₹${item.loanAmount}) [${item.status}]`);
        }
        console.log(`Successfully seeded ${SEED_LOANS.length} loan applications.`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error('Seeding loans failed:', err);
    process.exit(1);
});
