import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePayoutReceiptDto {
    @IsNotEmpty()
    @IsNumber()
    @Min(0.01, { message: 'Receipt amount must be greater than zero.' })
    amount!: number;

    @IsNotEmpty()
    @IsString()
    receivedDate!: string;

    @IsOptional()
    @IsString()
    reference?: string;

    @IsOptional()
    @IsString()
    receivedInto?: string;
}
