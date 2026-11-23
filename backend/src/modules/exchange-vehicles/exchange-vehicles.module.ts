import { Module } from '@nestjs/common';
import { ExchangeVehiclesController } from './exchange-vehicles.controller';
import { ExchangeVehiclesDocumentController } from './exchange-vehicles-document.controller';
import { ExchangeVehiclesInspectionController } from './exchange-vehicles-inspection.controller';
import { ExchangeVehiclesValuationController } from './exchange-vehicles-valuation.controller';
import { ExchangeVehiclesValuationService } from './exchange-vehicles-valuation.service';
import { ExchangeVehiclesInspectionService } from './exchange-vehicles-inspection.service';
import { ExchangeVehiclesDocumentService } from './exchange-vehicles-document.service';
import { ExchangeVehiclesOcrService } from './exchange-vehicles-ocr.service';
import { ExchangeVehiclesAuthenticityService } from './exchange-vehicles-authenticity.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ExchangeVehiclesBasePriceController } from './exchange-vehicles-base-price.controller';
import { ExchangeVehiclesBasePriceService } from './exchange-vehicles-base-price.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    ExchangeVehiclesBasePriceController,
    ExchangeVehiclesInspectionController,
    ExchangeVehiclesValuationController,
    ExchangeVehiclesDocumentController,
    ExchangeVehiclesController,
  ],

  providers: [
    ExchangeVehiclesInspectionService,
    ExchangeVehiclesValuationService,
    ExchangeVehiclesDocumentService,
    ExchangeVehiclesOcrService,
    ExchangeVehiclesAuthenticityService,
    ExchangeVehiclesBasePriceService,
  ],
})
export class ExchangeVehiclesModule { }