import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AccountType } from '../../../generated/prisma/enums';

export class CreateAccountDto {
  @IsString({ message: 'Account code must be a string' })
  @IsNotEmpty({ message: 'Account code is required' })
  @MaxLength(20, { message: 'Account code must not exceed 20 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  code!: string;

  @IsString({ message: 'Account name must be a string' })
  @IsNotEmpty({ message: 'Account name is required' })
  @MaxLength(150, { message: 'Account name must not exceed 150 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @IsEnum(AccountType, {
    message: 'type must be one of: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE',
  })
  @IsNotEmpty({ message: 'Account type is required' })
  type!: AccountType;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(255, { message: 'Description must not exceed 255 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  description?: string;

  @IsOptional()
  @IsString({ message: 'Branch ID must be a string' })
  @MaxLength(50, { message: 'Branch ID must not exceed 50 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  branchId?: string;
}
