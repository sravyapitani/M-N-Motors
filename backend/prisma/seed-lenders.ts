import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { PrismaService } from '../src/prisma/prisma.service';
import { LenderType } from '../src/generated/prisma/enums';

export interface SeedLenderItem {
  tallyLedgerName: string;
  name: string;
  type: LenderType;
  isActive: boolean;
}

export const LENDERS_SEED_DATA: SeedLenderItem[] = [
  // 1. AU Small Finance Bank
  {
    tallyLedgerName: 'Au Small Finance Bank Limited',
    name: 'AU Small Finance Bank',
    type: LenderType.BANK,
    isActive: true,
  },
  // 2. Axis Bank
  {
    tallyLedgerName: 'AXIS BANK  FINANCE PAYOUTS',
    name: 'Axis Bank',
    type: LenderType.BANK,
    isActive: true,
  },
  // 3. Bandhan Bank
  {
    tallyLedgerName: 'Bandhan Bank Finance Payouts',
    name: 'Bandhan Bank',
    type: LenderType.BANK,
    isActive: true,
  },
  // 4. Bank of Baroda
  {
    tallyLedgerName: 'Bank of Baroda Fin Payout',
    name: 'Bank of Baroda',
    type: LenderType.BANK,
    isActive: true,
  },
  // 5. Bank of India
  {
    tallyLedgerName: 'Bank Of India Finance Pay Out',
    name: 'Bank of India',
    type: LenderType.BANK,
    isActive: true,
  },
  // 6. BOI Shareholding (Non-loan support / depository)
  {
    tallyLedgerName: 'BOI Shareholding Ltd(Payouts)',
    name: 'BOI Shareholding',
    type: LenderType.OTHER,
    isActive: false,
  },
  // 7. Canara Bank
  {
    tallyLedgerName: 'Canara Bank Fin Pay Out',
    name: 'Canara Bank',
    type: LenderType.BANK,
    isActive: true,
  },
  // 8. Cholamandalam Investment & Finance
  {
    tallyLedgerName: 'Cholamandalam Inv& Finance Co Ltd - Payouts 18-19',
    name: 'Cholamandalam Investment & Finance',
    type: LenderType.NBFC,
    isActive: true,
  },
  // 9. Equitas Small Finance Bank
  {
    tallyLedgerName: 'EQUITAS SMALL FINANCE LTD-Finance Payouts',
    name: 'Equitas Small Finance Bank',
    type: LenderType.BANK,
    isActive: true,
  },
  // 10. HDB Financial Services
  {
    tallyLedgerName: 'HDB Bank Finance Payouts',
    name: 'HDB Financial Services',
    type: LenderType.NBFC,
    isActive: true,
  },
  // 11. HDFC Bank
  {
    tallyLedgerName: 'HDFC Bank Finance Payouts',
    name: 'HDFC Bank',
    type: LenderType.BANK,
    isActive: true,
  },
  // 12. HDFC Bank - Telangana
  {
    tallyLedgerName: 'HDFC Bank Finance Payouts - Telangana',
    name: 'HDFC Bank (Telangana)',
    type: LenderType.BANK,
    isActive: true,
  },
  // 13. Hinduja Leyland Finance
  {
    tallyLedgerName: 'HINDUJA LEYLAND FINANCE LTD-PAYOUT',
    name: 'Hinduja Leyland Finance',
    type: LenderType.NBFC,
    isActive: true,
  },
  // 14. ICICI Bank
  {
    tallyLedgerName: 'Icici Finance Payouts',
    name: 'ICICI Bank',
    type: LenderType.BANK,
    isActive: true,
  },
  // 15. ICICI Bank - IGST
  {
    tallyLedgerName: 'Icici Finance Payouts-IGST',
    name: 'ICICI Bank (IGST)',
    type: LenderType.BANK,
    isActive: true,
  },
  // 16. IDBI Bank
  {
    tallyLedgerName: 'IDBI BANK LIMITED-FINANCE PAYOUTS',
    name: 'IDBI Bank',
    type: LenderType.BANK,
    isActive: true,
  },
  // 17. IDFC FIRST Bank
  {
    tallyLedgerName: 'IDFC FIRST BANK LIMITED-PAYOUT',
    name: 'IDFC FIRST Bank',
    type: LenderType.BANK,
    isActive: true,
  },
  // 18. Indbank Global Support Services (Non-loan support / BPO)
  {
    tallyLedgerName: 'INDBANK GLOBAL SUPPORT SERVICES LIMITED',
    name: 'Indbank Global Support Services',
    type: LenderType.OTHER,
    isActive: false,
  },
  // 19. Indian Bank
  {
    tallyLedgerName: 'INDIAN BANK-FINACIAL PAYOUTS',
    name: 'Indian Bank',
    type: LenderType.BANK,
    isActive: true,
  },
  // 20. IndusInd Bank
  {
    tallyLedgerName: 'Indusind Bank Ltd - Finance Payouts - Inv',
    name: 'IndusInd Bank',
    type: LenderType.BANK,
    isActive: true,
  },
  // 21. IndusInd Bank - IGST
  {
    tallyLedgerName: 'Indusind Bank Ltd - Finance Payouts - Inv-IGST',
    name: 'IndusInd Bank (IGST)',
    type: LenderType.BANK,
    isActive: true,
  },
  // 22. Kotak Mahindra Bank
  {
    tallyLedgerName: 'Kotak Mahindra Bank Ltd - Payouts',
    name: 'Kotak Mahindra Bank',
    type: LenderType.BANK,
    isActive: true,
  },
  // 23. Kotak Mahindra Prime
  {
    tallyLedgerName: 'KOTAK MAHINDRA PRIME LTD',
    name: 'Kotak Mahindra Prime',
    type: LenderType.NBFC,
    isActive: true,
  },
  // 24. Mahindra Finance
  {
    tallyLedgerName: 'Mahindra Finance (Payouts)',
    name: 'Mahindra Finance',
    type: LenderType.NBFC,
    isActive: true,
  },
  // 25. Mahindra First Choice Wheels (Used car network)
  {
    tallyLedgerName: 'MAHINDRA FIRST CHOICE WHEELS  LIMITED(PAYOUT)',
    name: 'Mahindra First Choice Wheels',
    type: LenderType.OTHER,
    isActive: false,
  },
  // 26. Mahindra Insurance Brokers (Insurance)
  {
    tallyLedgerName: 'Mahindra Insurance Brokers Ltd - Insurance',
    name: 'Mahindra Insurance Brokers',
    type: LenderType.INSURANCE,
    isActive: false,
  },
  // 27. Mahindra Finance - Rajahmundry
  {
    tallyLedgerName: 'Mahindra Mahindra Financial Services - Rjy',
    name: 'Mahindra Finance (Rajahmundry)',
    type: LenderType.NBFC,
    isActive: true,
  },
  // 28. Mahindra Finance - Telangana
  {
    tallyLedgerName: 'Mahindra Mahindra Financial Services - Telangana',
    name: 'Mahindra Finance (Telangana)',
    type: LenderType.NBFC,
    isActive: true,
  },
  // 29. State Bank of India
  {
    tallyLedgerName: 'Sbi Finance Payouts',
    name: 'State Bank of India',
    type: LenderType.BANK,
    isActive: true,
  },
  // 30. Shriram Finance
  {
    tallyLedgerName: 'SHRIRAM FINANCE LTD-FINANCE PAYOUT INV',
    name: 'Shriram Finance',
    type: LenderType.NBFC,
    isActive: true,
  },
  // 31. Sundaram Finance
  {
    tallyLedgerName: 'Sundaram Finance Ltd - Financial Payouts',
    name: 'Sundaram Finance',
    type: LenderType.NBFC,
    isActive: true,
  },
  // 32. Tata Motors Insurance Broking (Insurance)
  {
    tallyLedgerName: 'TATA MOTORS INSURANCE BROKING AND ADVISORY SERVICES',
    name: 'Tata Motors Insurance Broking',
    type: LenderType.INSURANCE,
    isActive: false,
  },
  // 33. The New India Assurance (Insurance)
  {
    tallyLedgerName: 'The New India Assurance - INS Payout',
    name: 'The New India Assurance',
    type: LenderType.INSURANCE,
    isActive: false,
  },
  // 34. UBI Services (Support services)
  {
    tallyLedgerName: 'UBI SERVICES LTD',
    name: 'UBI Services',
    type: LenderType.OTHER,
    isActive: false,
  },
  // 35. Union Bank of India
  {
    tallyLedgerName: 'UNION BANK OF INDIA FIN PAY OUT',
    name: 'Union Bank of India',
    type: LenderType.BANK,
    isActive: true,
  },
  // 36. Varun Finance
  {
    tallyLedgerName: 'Varun Finance',
    name: 'Varun Finance',
    type: LenderType.NBFC,
    isActive: true,
  },
];

export async function seedLenders(prisma: PrismaService) {
  let createdCount = 0;
  let updatedCount = 0;

  for (const item of LENDERS_SEED_DATA) {
    const existing = await prisma.lender.findUnique({
      where: { tallyLedgerName: item.tallyLedgerName },
    });

    if (existing) {
      await prisma.lender.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          type: item.type,
          isActive: item.isActive,
        },
      });
      updatedCount += 1;
    } else {
      await prisma.lender.create({
        data: {
          tallyLedgerName: item.tallyLedgerName,
          name: item.name,
          type: item.type,
          isActive: item.isActive,
        },
      });
      createdCount += 1;
    }
  }

  return { createdCount, updatedCount, total: LENDERS_SEED_DATA.length };
}

async function main() {
  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    console.log('Connected to database. Seeding lenders from Tally "Finance for Payouts"...');
    const result = await seedLenders(prisma);
    console.log(
      `Successfully processed ${result.total} lenders (Created: ${result.createdCount}, Updated: ${result.updatedCount}).`
    );
  } catch (error) {
    console.error('Failed to seed lenders:', (error as Error).message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

