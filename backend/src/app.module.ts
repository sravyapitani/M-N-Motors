import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { FinanceLoanModule } from './modules/finance-loan/finance-loan.module';
import { GeneralLedgerModule } from './modules/general-ledger/general-ledger.module';
import { ExchangeVehiclesModule } from './modules/exchange-vehicles/exchange-vehicles.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    FinanceLoanModule,
    GeneralLedgerModule,
    ExchangeVehiclesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
