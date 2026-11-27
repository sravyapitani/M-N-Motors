import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFundingRepaymentDto {
    @IsNotEmpty()
    @IsString()
    paymentDate!: string;

    @IsNotEmpty()
    @Type(() => Number)
    @IsNumber()
    @IsPositive({ message: 'Repayment amount must be greater than 0' })
    amount!: number;

    @IsOptional()
    @IsString()
    reference?: string;

    @IsOptional()
    @IsString()
    notes?: string;
}
