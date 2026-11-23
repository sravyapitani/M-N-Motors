
import {
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsNumber,
    Min,
    MaxLength,
} from 'class-validator';

export class ReviewValuationDto {
    @IsIn(['APPROVED', 'REJECTED'])
    decision: 'APPROVED' | 'REJECTED';

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    reviewerName: string;

    @IsOptional()
    @IsNumber()
    @Min(0.01)
    finalValue?: number;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    remarks?: string;
}
