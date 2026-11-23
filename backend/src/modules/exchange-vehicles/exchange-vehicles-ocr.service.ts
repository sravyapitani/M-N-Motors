
import {
    Injectable,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { ExchangeVehiclesDocumentService } from './exchange-vehicles-document.service';

import { createWorker, PSM } from 'tesseract.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { pathToFileURL } from 'url';
import { createCanvas } from '@napi-rs/canvas';

function extractRcField(
    text: string,
    startLabel: string,
    endLabels: string[],
): string | null {
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    const escapedEndLabels = endLabels.map((label) =>
        label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );

    const endPattern = escapedEndLabels.length
        ? new RegExp(`^(?:${escapedEndLabels.join('|')})\\b`, 'i')
        : null;

    const startPattern = new RegExp(startLabel, 'i');

    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(startPattern);

        if (!match || match.index === undefined) {
            continue;
        }

        // Extract text appearing after the field label on the same line.
        const sameLineValue = lines[i]
            .slice(match.index + match[0].length)
            .replace(/^[\s:–-]+/, '')
            .trim();

        if (sameLineValue) {
            return sameLineValue;
        }

        // Otherwise, take the next line only if it is not another field label.
        const nextLine = lines[i + 1];

        if (
            nextLine &&
            !endPattern?.test(nextLine) &&
            !/^(?:TEST FILE ONLY|ILLUSTRATIVE TEST DOCUMENT|RC BOOK SAMPLE|FIELD SAMPLE VALUE)/i.test(nextLine)
        ) {
            return nextLine.trim();
        }

        return null;
    }

    return null;
}

@Injectable()
export class ExchangeVehiclesOcrService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly documentService: ExchangeVehiclesDocumentService,
    ) { }

    async extractRcBookText(vehicleId: string) {
        // 1. Check whether the vehicle exists
        const vehicle = await this.prisma.vehicle.findUnique({
            where: { id: vehicleId },
        });

        if (!vehicle) {
            throw new NotFoundException('Vehicle not found');
        }

        // 2. Fetch only current RC Book document versions
        const documents =
            await this.documentService.getVehicleDocuments(vehicleId);

        const currentDocuments = documents.filter(
            (doc) => doc.isCurrent,
        );

        const frontDocument = currentDocuments.find(
            (doc) => doc.documentType === 'RC_BOOK_FRONT',
        );

        const backDocument = currentDocuments.find(
            (doc) => doc.documentType === 'RC_BOOK_BACK',
        );


        if (!frontDocument || !backDocument) {
            throw new BadRequestException(
                'Both RC Book Front and Back documents are required',
            );
        }

        const extractedDocuments = [];

        // 3. Create OCR worker for image and scanned PDF processing
        const worker = await createWorker('eng');

        try {
            // 4. Process front and back documents
            for (const document of [frontDocument, backDocument]) {
                const result =
                    await this.documentService.getDocumentFile(
                        vehicleId,
                        document.id,
                    );

                if (!existsSync(result.absoluteFilePath)) {
                    throw new NotFoundException(
                        'RC Book document file not found',
                    );
                }

                const fileBuffer = readFileSync(result.absoluteFilePath);

                const extension = extname(
                    document.originalName,
                ).toLowerCase();

                // 5. Process image files using Tesseract
                if (['.jpg', '.jpeg', '.png'].includes(extension)) {
                    const ocrResult = await worker!.recognize(fileBuffer);

                    extractedDocuments.push({
                        documentType: document.documentType,
                        originalName: document.originalName,
                        extractionMethod: 'IMAGE_OCR',
                        extractedText: ocrResult.data.text,
                        confidence: ocrResult.data.confidence,
                        requiresImageOCR: false,
                    });

                    continue;
                }


                // 6. Extract text from PDFs and perform OCR on scanned pages
                if (extension === '.pdf') {
                    const pdfjs = await import(
                        'pdfjs-dist/legacy/build/pdf.mjs'
                    );

                    const standardFontDataUrl = pathToFileURL(
                        join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts') + '/'
                    ).href;

                    const loadingTask = pdfjs.getDocument({
                        data: new Uint8Array(fileBuffer),
                        standardFontDataUrl,
                    });

                    try {
                        const pdf = await loadingTask.promise;

                        const pageTexts: string[] = [];
                        const ocrConfidences: number[] = [];
                        let scannedPages = 0;

                        for (
                            let pageNumber = 1;
                            pageNumber <= pdf.numPages;
                            pageNumber++
                        ) {
                            const page = await pdf.getPage(pageNumber);
                            const textContent = await page.getTextContent();

                            const embeddedText = textContent.items
                                .map((item) => 'str' in item ? item.str : '')
                                .join(' ')
                                .trim();

                            // Use embedded text when available
                            // Preserve embedded PDF text when available
                            if (embeddedText.length > 0) {
                                pageTexts.push(embeddedText);
                            }

                            console.log('[RC PDF ROTATION]', {
                                originalRotation: page.rotate,
                                appliedRotation: (page.rotate + 270) % 360,
                            });

                            const viewport = page.getViewport({
                                scale: 3,
                                rotation: page.rotate,
                            });

                            const canvas = createCanvas(
                                Math.ceil(viewport.width),
                                Math.ceil(viewport.height),
                            );

                            const canvasContext = canvas.getContext('2d');

                            await page.render({
                                canvas: canvas as any,
                                canvasContext: canvasContext as any,
                                viewport,
                            }).promise;

                            const imageBuffer = canvas.toBuffer('image/png');

                            const debugImagePath = join(
                                process.cwd(),
                                `rc-ocr-debug-${document.documentType}-${pageNumber}.png`,
                            );

                            writeFileSync(debugImagePath, imageBuffer);

                            console.log('[RC DEBUG IMAGE SAVED]', {
                                path: debugImagePath,
                                exists: existsSync(debugImagePath),
                            });

                            console.log('[RC DEBUG] PDF page rendered:', {
                                documentType: document.documentType,
                                pageNumber,
                                imageBytes: imageBuffer.length,
                                workingDirectory: process.cwd(),
                            });

                            writeFileSync(
                                join(
                                    process.cwd(),
                                    `rc-ocr-debug-${document.documentType}-${pageNumber}.png`,
                                ),
                                imageBuffer,
                            );

                            const ocrResult = await worker.recognize(
                                imageBuffer,
                                {},
                                { blocks: true },
                            );

                            ocrConfidences.push(ocrResult.data.confidence);
                            scannedPages++;

                            let finalPageText = ocrResult.data.text;


                            // Extra OCR pass for the Vehicle Class heading at the top of the back RC.
                            if (document.documentType === 'RC_BOOK_BACK') {
                                const topCropHeight = Math.ceil(canvas.height * 0.35);

                                const topCropCanvas = createCanvas(
                                    canvas.width * 2,
                                    topCropHeight * 2,
                                );

                                const topCropContext = topCropCanvas.getContext('2d');

                                topCropContext.drawImage(
                                    canvas,
                                    0,
                                    0,
                                    canvas.width,
                                    topCropHeight,
                                    0,
                                    0,
                                    topCropCanvas.width,
                                    topCropCanvas.height,
                                );

                                try {
                                    await worker.setParameters({
                                        tessedit_char_whitelist: '',
                                        tessedit_pageseg_mode: PSM.AUTO,
                                    });

                                    const topOcrResult = await worker.recognize(
                                        topCropCanvas.toBuffer('image/png'),
                                    );

                                    console.log(
                                        '[RC TOP SECTION OCR]',
                                        topOcrResult.data.text,
                                    );

                                    finalPageText += '\n' + topOcrResult.data.text;
                                } finally {
                                    await worker.setParameters({
                                        tessedit_char_whitelist: '',
                                        tessedit_pageseg_mode: PSM.AUTO,
                                    });
                                }
                            }


                            // Find the chassis number line from Tesseract's structured output.
                            const ocrLines = ocrResult.data.blocks
                                ?.flatMap((block) =>
                                    block.paragraphs.flatMap((paragraph) => paragraph.lines),
                                ) ?? [];

                            // Use structured OCR lines if normal OCR text is empty
                            if (!finalPageText?.trim() && ocrLines.length > 0) {
                                finalPageText = ocrLines
                                    .map((line) => line.text)
                                    .join('\n')
                                    .trim();
                            }

                            console.log('[RC FINAL PAGE TEXT]', finalPageText);

                            console.log(
                                '[RC STRUCTURED OCR LINES]',
                                ocrLines.map((line) => line.text),
                            );

                            const chassisLine = ocrLines.find((line) =>
                                /(?:chassis|lnassis)\s*(?:no|number)/i.test(line.text),
                            );


                            console.log(
                                '[RC CHASSIS LINE DETECTED]',
                                chassisLine?.text ?? 'NOT FOUND',
                            );

                            console.log(
                                '[RC CHASSIS WORD POSITIONS]',
                                chassisLine?.words.map((word) => ({
                                    text: word.text,
                                    bbox: word.bbox,
                                })) ?? 'NO WORDS FOUND',
                            );




                            if (chassisLine) {
                                const chassisLineIndex = ocrLines.findIndex(
                                    (line) => line === chassisLine,
                                );

                                // The chassis value is often printed on the line below its label.
                                const candidateLines = ocrLines.slice(
                                    chassisLineIndex,
                                    chassisLineIndex + 3,
                                );

                                console.log(
                                    '[RC CHASSIS CANDIDATE LINES]',
                                    candidateLines.map((line) => line.text),
                                );

                                console.log(
                                    '[RC CHASSIS CANDIDATE WORD POSITIONS]',
                                    JSON.stringify(
                                        candidateLines.map((line) => ({
                                            line: line.text,
                                            words: line.words.map((word) => ({
                                                text: word.text,
                                                bbox: word.bbox,
                                            })),
                                        })),
                                        null,
                                        2,
                                    ),
                                );

                                const chassisWord = candidateLines
                                    .flatMap((line) => line.words)
                                    .find((word) =>
                                        /^[A-Z0-9]{17}$/i.test(word.text.trim()),
                                    );

                                if (!chassisWord) {
                                    console.log('[RC CHASSIS WORD]', 'NOT FOUND');
                                } else {
                                    const { x0, y0, x1, y1 } = chassisWord.bbox;

                                    // Include a little extra space around the number.
                                    const marginX = Math.ceil((x1 - x0) * 0.30);
                                    const marginY = Math.ceil((y1 - y0) * 0.80);

                                    const cropX = Math.max(0, x0 - marginX);
                                    const cropY = Math.max(0, y0 - marginY);

                                    const cropWidth = Math.min(
                                        canvas.width - cropX,
                                        x1 - x0 + marginX * 2,
                                    );

                                    const cropHeight = Math.min(
                                        canvas.height - cropY,
                                        y1 - y0 + marginY * 2,
                                    );

                                    console.log('[RC CHASSIS CROP]', {
                                        detectedWord: chassisWord.text,
                                        x: cropX,
                                        y: cropY,
                                        width: cropWidth,
                                        height: cropHeight,
                                    });

                                    if (cropWidth > 0 && cropHeight > 0) {
                                        const cropCanvas = createCanvas(
                                            Math.ceil(cropWidth * 4),
                                            Math.ceil(cropHeight * 4),
                                        );

                                        const cropContext = cropCanvas.getContext('2d');

                                        cropContext.drawImage(
                                            canvas,
                                            cropX,
                                            cropY,
                                            cropWidth,
                                            cropHeight,
                                            0,
                                            0,
                                            cropCanvas.width,
                                            cropCanvas.height,
                                        );

                                        const imageData = cropContext.getImageData(
                                            0,
                                            0,
                                            cropCanvas.width,
                                            cropCanvas.height,
                                        );

                                        const pixels = imageData.data;

                                        for (let i = 0; i < pixels.length; i += 4) {
                                            const gray =
                                                0.299 * pixels[i] +
                                                0.587 * pixels[i + 1] +
                                                0.114 * pixels[i + 2];

                                            const enhanced = Math.max(
                                                0,
                                                Math.min(255, (gray - 128) * 1.8 + 128),
                                            );

                                            pixels[i] = enhanced;
                                            pixels[i + 1] = enhanced;
                                            pixels[i + 2] = enhanced;
                                        }

                                        cropContext.putImageData(imageData, 0, 0);

                                        // Save the exact image being sent to targeted chassis OCR.
                                        const chassisDebugPath = join(
                                            process.cwd(),
                                            'rc-chassis-crop-debug.png',
                                        );

                                        writeFileSync(
                                            chassisDebugPath,
                                            cropCanvas.toBuffer('image/png'),
                                        );

                                        console.log('[RC CHASSIS DEBUG IMAGE SAVED]', chassisDebugPath);

                                        try {
                                            await worker.setParameters({
                                                tessedit_char_whitelist:
                                                    'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
                                                tessedit_pageseg_mode: PSM.SINGLE_WORD,
                                            });

                                            const chassisOcr = await worker.recognize(
                                                cropCanvas.toBuffer('image/png'),
                                            );

                                            console.log(
                                                '[RC TARGETED CHASSIS OCR]',
                                                chassisOcr.data.text.trim(),
                                            );

                                            finalPageText += '\n' + chassisOcr.data.text;
                                        } finally {
                                            await worker.setParameters({
                                                tessedit_char_whitelist: '',
                                                tessedit_pageseg_mode: PSM.AUTO,
                                            });
                                        }
                                    }
                                }
                            }


                            // Add OCR-generated text so it is included in the final extraction.
                            if (finalPageText?.trim()) {
                                pageTexts.push(finalPageText.trim());
                            }

                        } // End of PDF page loop

                        const extractedText = pageTexts.join('\n').trim();

                        pageTexts.length = pageTexts.length;
                        ocrConfidences.length = ocrConfidences.length;

                        console.log(
                            '\n========== RC RAW OCR TEXT ========== \n',
                            extractedText,
                        );

                        const averageConfidence = ocrConfidences.length
                            ? ocrConfidences.reduce((sum, value) => sum + value, 0) /
                            ocrConfidences.length
                            : null;

                        extractedDocuments.push({
                            documentType: document.documentType,
                            originalName: document.originalName,
                            extractionMethod:
                                scannedPages > 0
                                    ? 'PDF_TEXT_AND_IMAGE_OCR'
                                    : 'PDF_TEXT_EXTRACTION',
                            extractedText,
                            confidence: averageConfidence,
                            scannedPages,
                            totalPages: pdf.numPages,
                            requiresImageOCR: false,
                        });
                    } finally {
                        await loadingTask.destroy();
                    }

                    continue;
                }


                throw new BadRequestException(
                    `Unsupported RC document format: ${extension}`,
                );
            }

            // 7. Extract structured RC Book fields
            const frontText =
                extractedDocuments.find(
                    (doc) => doc.documentType === 'RC_BOOK_FRONT',
                )?.extractedText || '';

            const backText =
                extractedDocuments.find(
                    (doc) => doc.documentType === 'RC_BOOK_BACK',
                )?.extractedText || '';

            const combinedText = `${frontText} ${backText}`;


            const allRcText = `${frontText}\n${backText}`;



            // 7. Extract structured RC Book fields

            const lines = allRcText
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);

            // Read a field value from the same line or the following line.
            const getValueAfterLabel = (
                labelPattern: RegExp,
                preferNextLine = false,
            ): string | null => {
                for (let i = 0; i < lines.length; i++) {
                    const match = lines[i].match(labelPattern);

                    if (!match || match.index === undefined) {
                        continue;
                    }

                    const sameLineValue = lines[i]
                        .slice(match.index + match[0].length)
                        .replace(/^[\s:|=–—-]+/, '')
                        .trim();

                    if (preferNextLine || !sameLineValue || sameLineValue.length <= 2) {
                        const nextLine = lines[i + 1];

                        if (
                            nextLine &&
                            !/^(?:Regn\.?\s*(?:Number|No)|Engine|Chassis|Owner Name|Vehicle Class|Model Name|Colour|Color|Financer Name|Registration Authority)/i.test(nextLine)
                        ) {
                            return nextLine.trim();
                        }
                    }

                    return sameLineValue || null;
                }

                return null;
            };

            // Find an identifier on the line following its label.
            const getIdentifierAfterLabel = (
                labelPattern: RegExp,
                valuePattern: RegExp,
            ): string | null => {
                for (let i = 0; i < lines.length; i++) {
                    if (!labelPattern.test(lines[i])) {
                        continue;
                    }

                    for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j++) {
                        const match = lines[j].match(valuePattern);

                        if (match) {
                            return match[0].toUpperCase();
                        }
                    }
                }

                return null;
            };

            // Registration number is usually present in the registration row.
            const registrationNumber =
                allRcText.match(/\b[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}\b/i)?.[0] ?? null;

            // Registration date appears after the registration number.
            const registrationDate =
                allRcText.match(
                    /\b[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}\s+(\d{2}-\d{2}-\d{4})/i,
                )?.[1] ?? null;

            // Owner name: the next line is preferred because OCR may append stray letters
            // to the "Owner Name" label.
            const ownerName = getValueAfterLabel(
                /Owner\s*Name/i,
                true,
            )?.replace(/\s+[A-Z]$/i, '').replace(/\s+/g, ' ').trim() ?? null;

            // Vehicle model: OCR may put the value after a pipe character.
            const rawModel = getValueAfterLabel(/Model\s*Name/i, true);

            const vehicleModel = rawModel
                ?.split('|')
                .pop()
                ?.replace(/^[^A-Z0-9]*/, '')
                .replace(/\s+/g, ' ')
                .trim() ?? null;

            // Vehicle colour: remove OCR symbols and text before the final dash.
            const rawColour = getValueAfterLabel(/Colour/i, true);

            const vehicleColour = rawColour
                ?.replace(/^.*[-=]\s*/, '')
                .replace(/[^A-Z\s]/gi, '')
                .replace(/\s+/g, ' ')
                .trim() ?? null;

            // Financier: support both "Financier" and OCR's "Financer".
            const rawFinancier = getValueAfterLabel(
                /Financ(?:ier|er)\s*Name/i,
                true,
            );

            const financierName = rawFinancier
                ?.replace(/\s+[A-Za-z]{1,2}$/, '')
                .trim() ?? null;

            // Registration authority / RTO.
            const rawRto = getValueAfterLabel(
                /Registration\s*Authority/i,
                true,
            );

            const rtoCode = rawRto
                ?.replace(/^RTO\s*/i, '')
                .replace(/\s+/g, ' ')
                .trim() ?? null;

            // Vehicle class is normally printed on the same line as its label.
            const rawVehicleClass =
                getValueAfterLabel(
                    /Vehicle\s*Class\s*:/i,
                )
                    ?.replace(/[|<>]+$/g, '')
                    .replace(/\s+/g, ' ')
                    .trim() ?? null;

            // Correct the specific OCR error where the final V in LMV is missed.
            const vehicleClass = rawVehicleClass
                ? /^Motor\s*Car\s*\(\s*LM$/i.test(rawVehicleClass)
                    ? 'Motor Car (LMV)'
                    : rawVehicleClass
                : null;

            // Chassis and engine numbers are extracted from their following lines.
            const chassisNumber = getIdentifierAfterLabel(
                /Chassis\s*(?:Number|No\.?)/i,
                /\b[A-Z0-9]{17}\b/i,
            );

            const engineNumber = getIdentifierAfterLabel(
                /Engine\s*(?:\/\s*Motor\s*)?(?:Number|No\.?)/i,
                /\b[A-Z0-9]{8,20}\b/i,
            );

            // Hypothecation is kept separate from the financier field.
            const explicitHypothecation = getValueAfterLabel(
                /Hypothecation(?:\s*Details)?|Hypothecated\s*To/i,
            );

            const hypothecationDetails =
                explicitHypothecation || financierName || null;

            const rcFields = {
                registrationNumber,
                ownerName,
                vehicleClass,
                vehicleModel,
                registrationDate,
                rtoCode,
                chassisNumber,
                engineNumber,
                vehicleColour,
                hypothecationDetails,
                financierName,
            };
            console.log('[RC PARSED FIELDS]', rcFields);

            // 8. Compare extracted RC fields with vehicle records
            const normalizeValue = (value: string | null | undefined) =>
                value?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || null;

            const compareField = (
                rcValue: string | null,
                vehicleValue: string | null,
            ) => {
                if (!rcValue || !vehicleValue) {
                    return {
                        rcValue,
                        vehicleValue,
                        status: 'NOT_AVAILABLE',
                    };
                }

                const normalizedRc = normalizeValue(rcValue);
                const normalizedVehicle = normalizeValue(vehicleValue);

                if (normalizedRc === normalizedVehicle) {
                    return {
                        rcValue,
                        vehicleValue,
                        status: 'MATCH',
                    };
                }

                const ocrConfusionMap: Record<string, string> = {
                    '0': 'O',
                    O: '0',
                    '1': 'I',
                    I: '1',
                    '5': 'S',
                    S: '5',
                    '8': 'B',
                    B: '8',
                    '2': 'Z',
                    Z: '2',
                };

                const possibleOcrError =
                    normalizedRc?.length === normalizedVehicle?.length &&
                    [...(normalizedRc ?? '')].every(
                        (character, index) =>
                            character === normalizedVehicle?.[index] ||
                            ocrConfusionMap[character] === normalizedVehicle?.[index],
                    );

                return {
                    rcValue,
                    vehicleValue,
                    status: possibleOcrError
                        ? 'POSSIBLE_OCR_ERROR'
                        : 'MISMATCH',
                };
            };

            const comparison = {
                registrationNumber: compareField(
                    rcFields.registrationNumber,
                    vehicle.registrationNumber,
                ),

                chassisNumber: compareField(
                    rcFields.chassisNumber,
                    vehicle.chassisNumber,
                ),

                engineNumber: compareField(
                    rcFields.engineNumber,
                    vehicle.engineNumber,
                ),

                vehicleColour: compareField(
                    rcFields.vehicleColour,
                    vehicle.colour,
                ),
            };

            // 7. Return extracted information
            const extractedFieldCount = Object.values(rcFields).filter(
                (value) => value !== null,
            ).length;

            const missingFields = Object.entries(rcFields)
                .filter(([, value]) => value === null)
                .map(([field]) => field);

            // Identify documents with low OCR confidence
            const lowConfidenceDocuments = extractedDocuments
                .filter(
                    (doc) =>
                        doc.confidence !== null &&
                        doc.confidence !== undefined &&
                        doc.confidence < 60,
                )
                .map((doc) => ({
                    documentType: doc.documentType,
                    confidence: doc.confidence,
                    status: 'LOW_CONFIDENCE',
                    message: 'Document may be unclear. Manual verification is required.',
                }));

            // Identify documents where OCR confidence is unavailable
            const confidenceUnavailableDocuments = extractedDocuments
                .filter(
                    (doc) =>
                        doc.confidence === null ||
                        doc.confidence === undefined,
                )
                .map((doc) => ({
                    documentType: doc.documentType,
                    status: 'NOT_MEASURED',
                    message: 'OCR confidence could not be calculated.',
                }));

            return {
                success: true,
                message: 'RC Book text extraction and comparison completed',
                data: {
                    vehicleId,
                    documents: extractedDocuments,

                    extractedFields: rcFields,

                    extractionSummary: {
                        totalFields: Object.keys(rcFields).length,
                        extractedFields: extractedFieldCount,
                        missingFields,
                        lowConfidenceDocuments,
                        confidenceUnavailableDocuments,
                    },

                    comparison,

                    note:
                        'Field comparison identifies inconsistencies only. OCR extraction does not independently verify document authenticity. Manual review is required before a final verification decision.',
                },
            };


        } finally {
            if (worker) {
                await worker.terminate();
            }
        }
    }
}
