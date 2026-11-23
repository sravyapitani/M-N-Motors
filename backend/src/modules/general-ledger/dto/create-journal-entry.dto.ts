import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { JournalEntryLineDto } from './journal-entry-line.dto';
import { JournalStatus } from '../../../generated/prisma/enums';

export class CreateJournalEntryDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Entry date must be a valid date' })
  entryDate?: Date;

  @IsString({ message: 'Narration must be a string' })
  @IsNotEmpty({ message: 'Narration is required' })
  @MaxLength(500, { message: 'Narration must not exceed 500 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  narration!: string;

  @IsString({ message: 'Branch ID must be a string' })
  @IsNotEmpty({ message: 'Branch ID is required' })
  @MaxLength(50, { message: 'Branch ID must not exceed 50 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  branchId!: string;

  @IsOptional()
  @IsEnum(JournalStatus, {
    message: 'status must be one of: DRAFT, POSTED',
  })
  status?: JournalStatus;

  @IsOptional()
  @IsString({ message: 'Source module must be a string' })
  @MaxLength(50, { message: 'Source module must not exceed 50 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  sourceModule?: string;

  @IsOptional()
  @IsString({ message: 'Source reference must be a string' })
  @MaxLength(100, { message: 'Source reference must not exceed 100 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  sourceReference?: string;

  @IsArray({ message: 'Lines must be an array of journal lines' })
  @ArrayMinSize(2, { message: 'A journal entry must contain at least two lines' })
  @ValidateNested({ each: true })
  @Type(() => JournalEntryLineDto)
  lines!: JournalEntryLineDto[];
}
