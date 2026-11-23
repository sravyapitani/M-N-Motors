
import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExchangeVehiclesBasePriceService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    // Add a new vehicle base reference price
    async createBasePrice(body: {
        make: string;
        model: string;
        variant: string;
        modelYear: number;
        basePrice: number;
    }) {
        const make = body.make?.trim();
        const model = body.model?.trim();
        const variant = body.variant?.trim();

        if (!make || !model || !variant) {
            throw new BadRequestException(
                'Make, model and variant are required',
            );
        }

        if (
            !Number.isInteger(body.modelYear) ||
            body.modelYear < 1900 ||
            body.modelYear > new Date().getFullYear() + 1
        ) {
            throw new BadRequestException(
                'Please provide a valid model year',
            );
        }

        if (
            typeof body.basePrice !== 'number' ||
            !Number.isFinite(body.basePrice) ||
            body.basePrice <= 0
        ) {
            throw new BadRequestException(
                'Base price must be a valid positive number',
            );
        }

        const existing = await this.prisma.vehicleBasePrice.findUnique({
            where: {
                make_model_variant_modelYear: {
                    make,
                    model,
                    variant,
                    modelYear: body.modelYear,
                },
            },
        });

        if (existing) {
            throw new ConflictException(
                'A base price already exists for this make, model, variant and year. Update the existing record instead.',
            );
        }

        const saved = await this.prisma.vehicleBasePrice.create({
            data: {
                make,
                model,
                variant,
                modelYear: body.modelYear,
                basePrice: body.basePrice,
            },
        });

        return {
            success: true,
            message: 'Vehicle base price created successfully',
            data: saved,
        };
    }

    // View all configured base prices
    async getAllBasePrices() {
        const prices = await this.prisma.vehicleBasePrice.findMany({
            orderBy: [
                { make: 'asc' },
                { model: 'asc' },
                { modelYear: 'desc' },
            ],
        });

        return {
            success: true,
            message: 'Vehicle base prices fetched successfully',
            data: prices,
        };
    }

    // Update an existing base price
    async updateBasePrice(
        id: string,
        body: {
            basePrice?: number;
            isActive?: boolean;
        },
    ) {
        const existing = await this.prisma.vehicleBasePrice.findUnique({
            where: { id },
        });

        if (!existing) {
            throw new NotFoundException(
                'Vehicle base price record not found',
            );
        }

        if (
            body.basePrice !== undefined &&
            (
                typeof body.basePrice !== 'number' ||
                !Number.isFinite(body.basePrice) ||
                body.basePrice <= 0
            )
        ) {
            throw new BadRequestException(
                'Base price must be a valid positive number',
            );
        }

        if (
            body.isActive !== undefined &&
            typeof body.isActive !== 'boolean'
        ) {
            throw new BadRequestException(
                'isActive must be true or false',
            );
        }

        const updated = await this.prisma.vehicleBasePrice.update({
            where: { id },
            data: {
                ...(body.basePrice !== undefined && {
                    basePrice: body.basePrice,
                }),
                ...(body.isActive !== undefined && {
                    isActive: body.isActive,
                }),
            },
        });

        return {
            success: true,
            message: 'Vehicle base price updated successfully',
            data: updated,
        };
    }
}
