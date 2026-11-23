import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { LoanStatus } from '../../../generated/prisma/enums';

export class LoanQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100 records per page' })
  limit?: number = 20;

  @IsOptional()
  @IsEnum(LoanStatus, {
    message:
      'status must be one of: ENQUIRY, SUBMITTED, UNDER_REVIEW, SANCTIONED, DISBURSED, REJECTED',
  })
  status?: LoanStatus;

  @IsOptional()
  @IsString({ message: 'Lender must be a string' })
  @MaxLength(100, { message: 'Lender filter cannot exceed 100 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  lender?: string;

  @IsOptional()
  @IsString({ message: 'Branch ID must be a string' })
  @MaxLength(50, { message: 'Branch ID filter cannot exceed 50 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  branchId?: string;

  @IsOptional()
  @IsString({ message: 'Search term must be a string' })
  @MaxLength(100, { message: 'Search term cannot exceed 100 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  search?: string;
}
