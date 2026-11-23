import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VoidJournalEntryDto {
  @IsOptional()
  @IsString({ message: 'Void reason must be a string' })
  @MaxLength(255, { message: 'Void reason must not exceed 255 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  reason?: string;
}
