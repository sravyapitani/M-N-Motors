import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    Post,
    Patch,
    StreamableFile,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, resolve } from 'path';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { VehicleDocumentType } from '../../generated/prisma/client';
import { ExchangeVehiclesDocumentService } from './exchange-vehicles-document.service';
import { ExchangeVehiclesOcrService } from './exchange-vehicles-ocr.service';
import { ExchangeVehiclesAuthenticityService } from './exchange-vehicles-authenticity.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_FILE_TYPES: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
};

@Controller('exchange-vehicles')
export class ExchangeVehiclesDocumentController {
    constructor(
        private readonly documentService: ExchangeVehiclesDocumentService,
        private readonly ocrService: ExchangeVehiclesOcrService,
        private readonly authenticityService: ExchangeVehiclesAuthenticityService,
    ) { }
    @Post(':vehicleId/documents')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: (_request, _file, callback) => {
                    const uploadDirectory = resolve(
                        process.cwd(),
                        'uploads',
                        'exchange-vehicles',
                    );

                    mkdirSync(uploadDirectory, { recursive: true });
                    callback(null, uploadDirectory);
                },

                filename: (_request, file, callback) => {
                    const extension = extname(file.originalname).toLowerCase();
                    callback(null, `${randomUUID()}${extension}`);
                },
            }),

            limits: {
                fileSize: MAX_FILE_SIZE,
            },

            fileFilter: (_request, file, callback) => {
                const extension = extname(file.originalname).toLowerCase();
                const expectedMimeType = ALLOWED_FILE_TYPES[extension];

                if (!expectedMimeType || file.mimetype !== expectedMimeType) {
                    return callback(
                        new BadRequestException(
                            'Only PDF, JPG, JPEG and PNG files are allowed',
                        ),
                        false,
                    );
                }

                callback(null, true);
            },
        }),
    )
    async uploadRcBook(
        @Param('vehicleId') vehicleId: string,
        @Body('documentType') documentType: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        const allowedDocumentTypes = Object.values(VehicleDocumentType);

        if (!allowedDocumentTypes.includes(documentType as VehicleDocumentType)) {
            throw new BadRequestException(
                'Document type must be RC_BOOK_FRONT or RC_BOOK_BACK',
            );
        }

        const document = await this.documentService.saveDocument(
            vehicleId,
            documentType as VehicleDocumentType,
            file,
        );

        return {
            success: true,
            message: 'RC Book document uploaded successfully',
            data: {
                id: document.id,
                vehicleId: document.vehicleId,
                documentType: document.documentType,
                originalName: document.originalName,
                mimeType: document.mimeType,
                fileSize: document.fileSize,
                createdAt: document.createdAt,
            },
        };
    }
    @Get(':vehicleId/documents')
    async getVehicleDocuments(
        @Param('vehicleId') vehicleId: string,
    ) {
        const documents =
            await this.documentService.getVehicleDocuments(vehicleId);

        return {
            success: true,
            message: 'Vehicle documents fetched successfully',
            data: documents.map((document) => ({
                id: document.id,
                vehicleId: document.vehicleId,
                documentType: document.documentType,
                originalName: document.originalName,
                mimeType: document.mimeType,
                fileSize: document.fileSize,
                version: document.version,
                isCurrent: document.isCurrent,
                createdAt: document.createdAt,
            })),
        };
    }
    @Get(':vehicleId/documents/:documentId/file')
    async downloadDocument(
        @Param('vehicleId') vehicleId: string,
        @Param('documentId') documentId: string,
    ): Promise<StreamableFile> {
        const result = await this.documentService.getDocumentFile(
            vehicleId,
            documentId,
        );

        return new StreamableFile(
            createReadStream(result.absoluteFilePath),
            {
                type: result.document.mimeType,
                disposition: 'attachment',
            },
        );
    }
    @Post(':vehicleId/rc-book/extract')
    async extractRcBookText(
        @Param('vehicleId') vehicleId: string,
    ) {
        return this.ocrService.extractRcBookText(vehicleId);
    }

    @Post(':vehicleId/rc-book/verify')
    async verifyRcBook(
        @Param('vehicleId') vehicleId: string,
        @Body('extractedFields')
        extractedFields: {
            registrationNumber?: string | null;
            chassisNumber?: string | null;
            engineNumber?: string | null;
            vehicleColour?: string | null;
            hypothecationDetails?: string | null;
            financierName?: string | null;
        },
    ) {
        if (!extractedFields || typeof extractedFields !== 'object') {
            throw new BadRequestException(
                'Extracted RC Book fields are required for verification.',
            );
        }

        const verification =
            await this.authenticityService.assessVehicle(
                vehicleId,
                extractedFields,
            );

        return {
            success: true,
            message: 'RC Book verification checks completed.',
            data: verification,
        };
    }
    @Get(':vehicleId/rc-book/latest-verification')
    async getLatestRcBookVerification(
        @Param('vehicleId') vehicleId: string,
    ) {
        return {
            success: true,
            data: await this.authenticityService.getLatestVerification(vehicleId),
        };
    }
    @Patch(':vehicleId/rc-book/:verificationId/review')
    async reviewRcBook(
        @Param('vehicleId') vehicleId: string,
        @Param('verificationId') verificationId: string,
        @Body()
        body: {
            reviewStatus: 'APPROVED' | 'REJECTED' | 'NEEDS_RESUBMISSION';
            reviewerName: string;
            reviewRemarks?: string;
        },
    ) {
        return this.authenticityService.reviewVerification(
            vehicleId,
            verificationId,
            body,
        );
    }
}