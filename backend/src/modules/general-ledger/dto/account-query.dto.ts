import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AccountType } from '../../../generated/prisma/enums';

export class AccountQueryDto {
  @IsOptional()
  @IsEnum(AccountType, {
    message: 'type must be one of: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE',
  })
  type?: AccountType;

  @IsOptional()
  @IsString({ message: 'Branch ID must be a string' })
  @MaxLength(50, { message: 'Branch ID filter cannot exceed 50 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  branchId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;

  @IsOptional()
  @IsString({ message: 'Search term must be a string' })
  @MaxLength(100, { message: 'Search term cannot exceed 100 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  search?: string;
}
