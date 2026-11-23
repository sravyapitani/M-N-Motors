import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { LenderType } from '../../../generated/prisma/enums';

export class LenderQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;

  @IsOptional()
  @IsEnum(LenderType, {
    message: `type must be one of: ${Object.values(LenderType).join(', ')}`,
  })
  type?: LenderType;

  @IsOptional()
  @IsString({ message: 'Search term must be a string' })
  @MaxLength(100, { message: 'Search term cannot exceed 100 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;
}

