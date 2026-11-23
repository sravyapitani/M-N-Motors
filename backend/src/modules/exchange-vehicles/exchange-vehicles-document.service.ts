
import {
    Injectable,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VehicleDocumentType } from '../../generated/prisma/client';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { isAbsolute, relative, resolve } from 'path';
import { createHash } from 'crypto';

@Injectable()
export class ExchangeVehiclesDocumentService {
    constructor(private readonly prisma: PrismaService) { }

    async saveDocument(
        vehicleId: string,
        documentType: VehicleDocumentType,
        file: Express.Multer.File,
    ) {
        const vehicle = await this.prisma.vehicle.findUnique({
            where: { id: vehicleId },
            select: { id: true },
        });

        if (!vehicle) {
            throw new NotFoundException('Vehicle not found');
        }

        if (!file?.path || !existsSync(file.path)) {
            throw new BadRequestException('Uploaded document file is missing');
        }

        // Calculate SHA-256 hash to identify changes to the stored file.
        const fileBuffer = readFileSync(file.path);
        const fileHash = createHash('sha256')
            .update(fileBuffer)
            .digest('hex');

        const result = await this.prisma.$transaction(async (tx) => {
            const previousDocument =
                await tx.vehicleDocument.findFirst({
                    where: {
                        vehicleId,
                        documentType,
                    },
                    orderBy: { version: 'desc' },
                });

            const nextVersion = (previousDocument?.version ?? 0) + 1;
            const now = new Date();

            // Preserve previous versions instead of deleting them.
            await tx.vehicleDocument.updateMany({
                where: {
                    vehicleId,
                    documentType,
                    isCurrent: true,
                },
                data: {
                    isCurrent: false,
                    replacedAt: now,
                },
            });

            const newDocument = await tx.vehicleDocument.create({
                data: {
                    vehicleId,
                    documentType,
                    originalName: file.originalname,
                    storedName: file.filename,
                    filePath: file.path,
                    mimeType: file.mimetype,
                    fileSize: file.size,
                    version: nextVersion,
                    isCurrent: true,
                    fileHash,
                },
            });

            // Any earlier verification is now outdated because
            // the RC document set has changed.
            await tx.rcBookVerification.updateMany({
                where: {
                    vehicleId,
                    isOutdated: false,
                },
                data: {
                    isOutdated: true,
                },
            });

            return newDocument;
        });

        return result;
    }

    async getVehicleDocuments(vehicleId: string) {
        const vehicle = await this.prisma.vehicle.findUnique({
            where: { id: vehicleId },
            select: { id: true },
        });

        if (!vehicle) {
            throw new NotFoundException('Vehicle not found');
        }

        return this.prisma.vehicleDocument.findMany({
            where: {
                vehicleId,
                isCurrent: true,
            },
            orderBy: [
                { documentType: 'asc' },
                { version: 'desc' },
            ],
        });
    }

    async getDocumentFile(vehicleId: string, documentId: string) {
        const document = await this.prisma.vehicleDocument.findFirst({
            where: {
                id: documentId,
                vehicleId,
            },
        });

        if (!document) {
            throw new NotFoundException('Vehicle document not found');
        }

        const uploadDirectory = resolve(
            process.cwd(),
            'uploads',
            'exchange-vehicles',
        );

        const absoluteFilePath = resolve(document.filePath);
        const relativeFilePath = relative(
            uploadDirectory,
            absoluteFilePath,
        );

        if (
            relativeFilePath.startsWith('..') ||
            isAbsolute(relativeFilePath)
        ) {
            throw new BadRequestException('Invalid document storage path');
        }

        if (!existsSync(absoluteFilePath)) {
            throw new NotFoundException('Stored document file not found');
        }

        return {
            document,
            absoluteFilePath,
        };
    }

    async deleteVehicleDocuments(vehicleId: string) {
        const documents = await this.prisma.vehicleDocument.findMany({
            where: { vehicleId },
            select: { filePath: true },
        });

        const uploadDirectory = resolve(
            process.cwd(),
            'uploads',
            'exchange-vehicles',
        );

        const filesToDelete: string[] = [];

        for (const document of documents) {
            const absoluteFilePath = resolve(document.filePath);
            const relativeFilePath = relative(
                uploadDirectory,
                absoluteFilePath,
            );

            if (
                relativeFilePath.startsWith('..') ||
                isAbsolute(relativeFilePath)
            ) {
                throw new BadRequestException('Invalid document storage path');
            }

            if (existsSync(absoluteFilePath)) {
                filesToDelete.push(absoluteFilePath);
            }
        }

        return filesToDelete;
    }
    removeStoredFiles(filePaths: string[]) {
        for (const filePath of filePaths) {
            try {
                if (existsSync(filePath)) {
                    unlinkSync(filePath);
                }
            } catch (error) {
                console.error(
                    `Unable to delete uploaded document: ${filePath}`,
                    error,
                );
            }
        }
    }
}
