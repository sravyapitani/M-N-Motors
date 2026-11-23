
import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ExchangeVehiclesDocumentService } from './exchange-vehicles-document.service';

@Controller('exchange-vehicles')
export class ExchangeVehiclesController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly documentService: ExchangeVehiclesDocumentService,
    ) { }

    @Get('health')
    checkHealth() {
        return {
            success: true,
            message: 'Exchange Vehicles backend is running',
        };
    }

    @Post()
    async createIntake(
        @Body()
        body: {
            customerName: string;
            vehicleName: string;
            make?: string;
            model?: string;
            variant?: string;
            modelYear?: number;
            fuelType: 'PETROL' | 'DIESEL' | 'CNG' | 'EV';
            vehicleSegment: 'PASSENGER' | 'COMMERCIAL' | 'THREE_WHEELER';
            odometerKm: number;
            previousOwnerCount?: number;
            branchId: string;
            registrationNumber?: string;
            chassisNumber?: string;
            engineNumber?: string;
            colour: string;
            registrationDate?: string;
        },
    ) {
        if (
            !body.customerName?.trim() ||
            !body.vehicleName?.trim() ||
            !body.colour?.trim() ||
            !body.branchId?.trim() ||
            body.odometerKm === undefined ||
            body.odometerKm === null ||
            !Number.isInteger(Number(body.odometerKm)) ||
            Number(body.odometerKm) < 0
        ) {
            throw new BadRequestException(
                'Customer name, vehicle name, colour, valid odometer and branch ID are required',
            );
        }
        if (
            (body.make !== undefined && typeof body.make !== 'string') ||
            (body.model !== undefined && typeof body.model !== 'string') ||
            (body.variant !== undefined && typeof body.variant !== 'string')
        ) {
            throw new BadRequestException(
                'Make, model and variant must be text',
            );
        }
        if (
            body.modelYear !== undefined &&
            (!Number.isInteger(Number(body.modelYear)) ||
                Number(body.modelYear) <= 0)
        ) {
            throw new BadRequestException(
                'Model year must be a valid positive integer',
            );
        }

        if (!['PETROL', 'DIESEL', 'CNG', 'EV'].includes(body.fuelType)) {
            throw new BadRequestException('Please select a valid fuel type');
        }

        if (!['PASSENGER', 'COMMERCIAL', 'THREE_WHEELER'].includes(body.vehicleSegment)) {
            throw new BadRequestException('Please select a valid vehicle segment');
        }

        if (
            body.previousOwnerCount !== undefined &&
            (!Number.isInteger(Number(body.previousOwnerCount)) ||
                Number(body.previousOwnerCount) < 0)
        ) {
            throw new BadRequestException(
                'Previous owner count must be a non-negative integer',
            );
        }
        if (body.registrationDate !== undefined) {
            const registrationDate = new Date(body.registrationDate);

            if (
                Number.isNaN(registrationDate.getTime()) ||
                registrationDate > new Date()
            ) {
                throw new BadRequestException(
                    'Registration date must be valid and cannot be in the future',
                );
            }
        }

        const branch = await this.prisma.branch.findFirst({
            where: {
                id: body.branchId.trim(),
                isActive: true,
            },
        });

        if (!branch) {
            throw new BadRequestException(
                'Selected branch does not exist or is inactive',
            );
        }

        const existingVehicle = await this.prisma.vehicle.findFirst({
            where: {
                OR: [
                    ...(body.registrationNumber?.trim()
                        ? [{ registrationNumber: body.registrationNumber.trim() }]
                        : []),
                    ...(body.chassisNumber?.trim()
                        ? [{ chassisNumber: body.chassisNumber.trim() }]
                        : []),
                    ...(body.engineNumber?.trim()
                        ? [{ engineNumber: body.engineNumber.trim() }]
                        : []),
                ],
            },
        });

        if (existingVehicle) {
            throw new BadRequestException(
                'A vehicle with this registration number or chassis number already exists',
            );
        }

        const vehicle = await this.prisma.vehicle.create({
            data: {
                customerName: body.customerName.trim(),
                vehicleName: body.vehicleName.trim(),
                make: body.make?.trim() || null,
                model: body.model?.trim() || null,
                variant: body.variant?.trim() || null,
                modelYear: body.modelYear === undefined ? null : Number(body.modelYear),
                fuelType: body.fuelType,
                vehicleSegment: body.vehicleSegment,
                previousOwnerCount:
                    body.previousOwnerCount === undefined
                        ? null
                        : Number(body.previousOwnerCount),
                odometerKm: Number(body.odometerKm),
                branchId: body.branchId.trim(),
                stage: 'INTAKE',
                registrationNumber: body.registrationNumber?.trim() || null,
                chassisNumber: body.chassisNumber?.trim() || null,
                engineNumber: body.engineNumber?.trim() || null,
                colour: body.colour.trim(),
                registrationDate: body.registrationDate
                    ? new Date(body.registrationDate)
                    : null,
            },
        });

        return {
            success: true,
            message: 'Exchange intake created successfully',
            data: vehicle,
        };
    }
    @Get()
    async getAllVehicles(@Query('branchId') branchId?: string) {
        const vehicles = await this.prisma.vehicle.findMany({
            where: branchId ? { branchId } : undefined,
            orderBy: { createdAt: 'desc' },
        });

        return {
            success: true,
            message: 'Exchange vehicles fetched successfully',
            data: vehicles,
        };
    }
    @Get(':id')
    async getVehicleById(@Param('id') id: string) {
        const vehicle = await this.prisma.vehicle.findUnique({
            where: { id },
        });

        if (!vehicle) {
            throw new NotFoundException('Vehicle not found');
        }

        return {
            success: true,
            message: 'Vehicle fetched successfully',
            data: vehicle,
        };
    }


    @Patch(':id/details')
    async updateVehicleDetails(
        @Param('id') id: string,
        @Body()
        body: {
            registrationNumber?: string;
            chassisNumber?: string;
            engineNumber?: string;
            modelYear?: number;
            odometerKm: number;
        },
    ) {
        const existingVehicle = await this.prisma.vehicle.findUnique({
            where: { id },
        });

        if (!existingVehicle) {
            throw new NotFoundException('Vehicle not found');
        }

        if (
            body.modelYear !== undefined &&
            (!Number.isInteger(Number(body.modelYear)) ||
                Number(body.modelYear) <= 0)
        ) {
            throw new BadRequestException('Invalid manufacturing year');
        }

        if (
            body.odometerKm !== undefined &&
            (!Number.isInteger(Number(body.odometerKm)) ||
                Number(body.odometerKm) < 0)
        ) {
            throw new BadRequestException('Invalid odometer reading');
        }

        const updatedVehicle = await this.prisma.vehicle.update({
            where: { id },
            data: {
                ...(body.registrationNumber !== undefined && {
                    registrationNumber: body.registrationNumber.trim() || null,
                }),
                ...(body.chassisNumber !== undefined && {
                    chassisNumber: body.chassisNumber.trim() || null,
                }),
                ...(body.engineNumber !== undefined && {
                    engineNumber: body.engineNumber.trim() || null,
                }),
                ...(body.modelYear !== undefined && {
                    modelYear: Number(body.modelYear),
                }),
                ...(body.odometerKm !== undefined && {
                    odometerKm: Number(body.odometerKm),
                }),
            },
        });

        return {
            success: true,
            message: 'Vehicle details updated successfully',
            data: updatedVehicle,
        };
    }


    @Patch(':id/stage')
    async updateVehicleStage(
        @Param('id') id: string,
        @Body() body: { stage: string },
    ) {
        const allowedStages = [
            'INTAKE',
            'INSPECTION',
            'VALUATION',
            'APPROVAL',
            'PURCHASED',
            'REFURBISHMENT',
            'LISTED',
            'RESOLD',
            'CANCELLED',
        ];

        if (!allowedStages.includes(body.stage)) {
            throw new BadRequestException('Invalid vehicle stage');
        }

        const existingVehicle = await this.prisma.vehicle.findUnique({
            where: { id },
        });

        if (!existingVehicle) {
            throw new NotFoundException('Vehicle not found');
        }

        const updatedVehicle = await this.prisma.vehicle.update({
            where: { id },
            data: { stage: body.stage as any },
        });

        return {
            success: true,
            message: 'Vehicle stage updated successfully',
            data: updatedVehicle,
        };
    }

    @Delete(':id')
    async deleteVehicle(@Param('id') id: string) {
        // 1. Check whether the vehicle exists
        const vehicle = await this.prisma.vehicle.findUnique({
            where: { id },
            select: { id: true },
        });

        if (!vehicle) {
            throw new NotFoundException('Vehicle not found');
        }

        // 2. Collect uploaded document file paths
        const filePaths =
            await this.documentService.deleteVehicleDocuments(id);

        // 3. Delete vehicle and related database records
        await this.prisma.vehicle.delete({
            where: { id },
        });

        // 4. Remove uploaded document files
        this.documentService.removeStoredFiles(filePaths);

        return {
            success: true,
            message: 'Vehicle and related records deleted successfully',
        };
    }

    @Get('branches/active')
    async getActiveBranches() {
        const branches = await this.prisma.branch.findMany({
            where: { isActive: true },
            select: {
                id: true,
                code: true,
                name: true,
            },
            orderBy: {
                name: 'asc',
            },
        });

        return {
            success: true,
            message: 'Active branches fetched successfully',
            data: branches,
        };
    }

}
