import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePayoutDto {
    @IsOptional()
    @IsNumber()
    @Min(0, { message: 'Expected payout amount cannot be negative.' })
    expectedAmount?: number;

    @IsOptional()
    @IsString()
    expectedDate?: string;

    @IsOptional()
    @IsString()
    notes?: string;
}
