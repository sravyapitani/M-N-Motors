import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { GeneralLedgerModule } from '../general-ledger/general-ledger.module';
import { FinanceLoanController } from './finance-loan.controller';
import { FinanceLenderController } from './finance-lender.controller';
import { FinancePayoutController } from './finance-payout.controller';
import { FinanceFundingController } from './finance-funding.controller';
import { FinanceLoanService } from './finance-loan.service';
import { FinanceFundingService } from './finance-funding.service';

@Module({
  imports: [PrismaModule, GeneralLedgerModule],
  controllers: [
    FinanceLoanController,
    FinanceLenderController,
    FinancePayoutController,
    FinanceFundingController,
  ],
  providers: [FinanceLoanService, FinanceFundingService],
  exports: [FinanceLoanService, FinanceFundingService],
})
export class FinanceLoanModule {}
