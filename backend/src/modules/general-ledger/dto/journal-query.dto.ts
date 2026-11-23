import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { JournalStatus } from '../../../generated/prisma/enums';

export class JournalQueryDto {
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
  @IsEnum(JournalStatus, {
    message: 'status must be one of: DRAFT, POSTED, VOID',
  })
  status?: JournalStatus;

  @IsOptional()
  @IsString({ message: 'Branch ID must be a string' })
  @MaxLength(50, { message: 'Branch ID filter cannot exceed 50 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  branchId?: string;

  @IsOptional()
  @IsString({ message: 'Source module must be a string' })
  @MaxLength(50, { message: 'Source module filter cannot exceed 50 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  sourceModule?: string;

  @IsOptional()
  @IsString({ message: 'Source reference must be a string' })
  @MaxLength(100, { message: 'Source reference filter cannot exceed 100 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  sourceReference?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Start date must be a valid date' })
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'End date must be a valid date' })
  endDate?: Date;

  @IsOptional()
  @IsString({ message: 'Search term must be a string' })
  @MaxLength(100, { message: 'Search term cannot exceed 100 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  search?: string;
}
