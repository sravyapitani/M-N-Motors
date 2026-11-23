import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateLoanDto {
  @IsString({ message: 'Customer name must be a string' })
  @IsNotEmpty({ message: 'Customer name is required' })
  @MaxLength(150, { message: 'Customer name must not exceed 150 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  customerName!: string;

  @IsOptional()
  @IsString({ message: 'Lender ID must be a string' })
  @MaxLength(50, { message: 'Lender ID must not exceed 50 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  lenderId?: string;

  @IsOptional()
  @IsString({ message: 'Lender name must be a string' })
  @MaxLength(100, { message: 'Lender name must not exceed 100 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  lenderName?: string;

  @IsNumber({}, { message: 'Loan amount must be a number' })
  @IsPositive({ message: 'Loan amount must be greater than zero' })
  @Min(1, { message: 'Loan amount must be at least 1' })
  @Max(1_000_000_000, { message: 'Loan amount exceeds maximum allowed limit' })
  loanAmount!: number;

  @IsNumber({}, { message: 'Interest rate must be a number' })
  @Min(0, { message: 'Interest rate cannot be negative' })
  @Max(100, { message: 'Interest rate cannot exceed 100%' })
  interestRate!: number;

  @IsInt({ message: 'Tenure must be an integer number of months' })
  @IsPositive({ message: 'Tenure months must be greater than zero' })
  @Min(1, { message: 'Tenure must be at least 1 month' })
  @Max(360, { message: 'Tenure cannot exceed 360 months (30 years)' })
  tenureMonths!: number;

  @IsOptional()
  @IsNumber({}, { message: 'Commission amount must be a number' })
  @Min(0, { message: 'Commission amount cannot be negative' })
  @Max(100_000_000, { message: 'Commission amount exceeds maximum allowed limit' })
  commissionAmount?: number;

  @IsString({ message: 'Branch ID must be a string' })
  @IsNotEmpty({ message: 'Branch ID is required' })
  @MaxLength(50, { message: 'Branch ID must not exceed 50 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  branchId!: string;
}
