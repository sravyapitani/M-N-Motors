
import {
    IsNumber,
    IsOptional,
    IsString,
    Min,
    MaxLength,
} from 'class-validator';

export class CalculateValuationDto {
    @IsOptional()
    @IsNumber()
    @Min(0.01)
    negotiatedBaseValue?: number;

    @IsOptional()
    @IsNumber()
    @Min(0.01)
    evaluatorQuotedValue?: number;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    evaluatorRemarks?: string;
}
