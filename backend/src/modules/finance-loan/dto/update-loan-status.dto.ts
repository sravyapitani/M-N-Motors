import { IsEnum, IsNotEmpty } from 'class-validator';
import { LoanStatus } from '../../../generated/prisma/enums';

export class UpdateLoanStatusDto {
  @IsEnum(LoanStatus, {
    message:
      'status must be one of: ENQUIRY, SUBMITTED, UNDER_REVIEW, SANCTIONED, DISBURSED, REJECTED',
  })
  @IsNotEmpty()
  status!: LoanStatus;
}
