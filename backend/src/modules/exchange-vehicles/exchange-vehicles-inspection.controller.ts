
import {
    Controller,
    Get,
    Post,
    Param,
    Body,
} from '@nestjs/common';

import { ExchangeVehiclesInspectionService } from './exchange-vehicles-inspection.service';

@Controller('exchange-vehicles')
export class ExchangeVehiclesInspectionController {
    constructor(
        private readonly inspectionService: ExchangeVehiclesInspectionService,
    ) { }

    @Post(':id/inspection/validate')
    validateInspection(
        @Param('id') id: string,
        @Body()
        body: {
            condition?: string;
            notes?: string;
            inspectionScore?: number;
            accidentHistory?: boolean | null;
            accidentSeverity?: 'MINOR' | 'MODERATE' | 'MAJOR' | null;
            repaintHistory?: boolean | null;
            repaintCoverage?: 'ONE_TO_TWO_PANELS' | 'THREE_TO_FIVE_PANELS' | 'FULL_BODY' | null;
            fullServiceHistory?: boolean | null;
        },
    ) {
        return this.inspectionService.saveInspection(id, body);
    }
    @Get(':id/inspection')
    getInspectionHistory(@Param('id') id: string) {
        return this.inspectionService.getInspectionHistory(id);
    }
}
