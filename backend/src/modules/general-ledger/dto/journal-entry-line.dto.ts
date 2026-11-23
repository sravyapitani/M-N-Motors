import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class JournalEntryLineDto {
  @IsString({ message: 'Account ID must be a string' })
  @IsNotEmpty({ message: 'Account ID is required' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  accountId!: string;

  @IsOptional()
  @IsString({ message: 'Line description must be a string' })
  @MaxLength(255, { message: 'Line description must not exceed 255 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  description?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Debit amount must be a number' })
  @Min(0, { message: 'Debit amount cannot be negative' })
  @Max(1_000_000_000, { message: 'Debit amount exceeds maximum limit' })
  debitAmount?: number = 0;

  @IsOptional()
  @IsNumber({}, { message: 'Credit amount must be a number' })
  @Min(0, { message: 'Credit amount cannot be negative' })
  @Max(1_000_000_000, { message: 'Credit amount exceeds maximum limit' })
  creditAmount?: number = 0;
}
