import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFundingDrawDto {
    @IsNotEmpty()
    @IsString()
    facilityId!: string;

    @IsNotEmpty()
    @IsString()
    drawDate!: string;

    @IsNotEmpty()
    @Type(() => Number)
    @IsNumber()
    @IsPositive({ message: 'Draw amount must be greater than 0' })
    amount!: number;

    @IsOptional()
    @IsString()
    reference?: string;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsString()
    branchId?: string;
}
