
import {
    Controller,
    Post,
    Get,
    Patch,
    Body,
    Param,
} from '@nestjs/common';

import { ExchangeVehiclesBasePriceService } from './exchange-vehicles-base-price.service';

@Controller('exchange-vehicles/base-prices')
export class ExchangeVehiclesBasePriceController {
    constructor(
        private readonly basePriceService: ExchangeVehiclesBasePriceService,
    ) { }

    // Add a new vehicle base price
    @Post()
    async createBasePrice(
        @Body()
        body: {
            make: string;
            model: string;
            variant: string;
            modelYear: number;
            basePrice: number;
        },
    ) {
        return this.basePriceService.createBasePrice(body);
    }

    // Fetch all vehicle base prices
    @Get()
    async getAllBasePrices() {
        return this.basePriceService.getAllBasePrices();
    }

    // Update price or active status
    @Patch(':id')
    async updateBasePrice(
        @Param('id') id: string,
        @Body()
        body: {
            basePrice?: number;
            isActive?: boolean;
        },
    ) {
        return this.basePriceService.updateBasePrice(id, body);
    }
}
