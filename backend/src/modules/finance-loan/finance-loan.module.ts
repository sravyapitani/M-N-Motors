import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { GeneralLedgerModule } from '../general-ledger/general-ledger.module';
import { FinanceLoanController } from './finance-loan.controller';
import { FinanceLenderController } from './finance-lender.controller';
import { FinanceLoanService } from './finance-loan.service';

@Module({
  imports: [PrismaModule, GeneralLedgerModule],
  controllers: [FinanceLoanController, FinanceLenderController],
  providers: [FinanceLoanService],
  exports: [FinanceLoanService],
})
export class FinanceLoanModule {}
