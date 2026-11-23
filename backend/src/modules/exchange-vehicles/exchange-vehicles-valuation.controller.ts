import {
    Controller,
    Get,
    Post,
    Param,
    Body,
} from '@nestjs/common';

import { ExchangeVehiclesValuationService } from './exchange-vehicles-valuation.service';
import { CalculateValuationDto } from './dto/calculate-valuation.dto';
import { ReviewValuationDto } from './dto/review-valuation.dto';

@Controller('exchange-vehicles')
export class ExchangeVehiclesValuationController {
    constructor(
        private readonly valuationService: ExchangeVehiclesValuationService,
    ) { }

    @Get(':id/valuation/eligibility')

    checkValuationEligibility(
        @Param('id') id: string,
    ) {
        return this.valuationService.checkValuationEligibility(id);
    }
    @Get(':id/valuation/base-price')
    getBaseReferencePrice(
        @Param('id') id: string,
    ) {
        return this.valuationService.getBaseReferencePrice(id);
    }
    @Get(':id/valuation/age-depreciation')
    getAgeDepreciation(
        @Param('id') id: string,
    ) {
        return this.valuationService.getAgeDepreciation(id);
    }
    @Get(':id/valuation/mileage-adjustment')
    getMileageAdjustment(
        @Param('id') id: string,
    ) {
        return this.valuationService.getMileageAdjustment(id);
    }

    @Get(':id/valuation/condition-adjustment')
    getConditionAdjustment(
        @Param('id') id: string,
    ) {
        return this.valuationService.getConditionAdjustment(id);
    }

    @Get(':id/valuation/extra-owner-deduction')
    getExtraOwnerDeduction(
        @Param('id') id: string,
    ) {
        return this.valuationService.getExtraOwnerDeduction(id);
    }

    @Get(':id/valuation/accident-repaint-deduction')
    getAccidentRepaintDeduction(
        @Param('id') id: string,
    ) {
        return this.valuationService.getAccidentRepaintDeduction(id);
    }

    @Get(':id/valuation/service-history-premium')
    getServiceHistoryPremium(
        @Param('id') id: string,
    ) {
        return this.valuationService.getServiceHistoryPremium(id);
    }
    @Post(':id/valuation/calculate')
    calculateValuation(
        @Param('id') id: string,
        @Body() dto: CalculateValuationDto,
    ) {
        return this.valuationService.calculateValuation(id, dto);
    }
    @Get(':id/valuation/latest')
    getLatestValuation(@Param('id') id: string) {
        return this.valuationService.getLatestValuation(id);
    }

    @Get(':id/valuation/history')
    getValuationHistory(@Param('id') id: string) {
        return this.valuationService.getValuationHistory(id);
    }

    @Post('valuation/:valuationId/review')
    reviewValuation(
        @Param('valuationId') valuationId: string,
        @Body() dto: ReviewValuationDto,
    ) {
        return this.valuationService.reviewValuation(
            valuationId,
            dto,
        );
    }
}