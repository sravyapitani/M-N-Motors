import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { GeneralLedgerService } from './general-ledger.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { AccountQueryDto } from './dto/account-query.dto';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { JournalQueryDto } from './dto/journal-query.dto';
import { VoidJournalEntryDto } from './dto/void-journal-entry.dto';

interface RequestWithUser {
  user: AuthenticatedUser;
}

@Controller('ledger')
@UseGuards(JwtAuthGuard)
export class GeneralLedgerController {
  constructor(private readonly ledgerService: GeneralLedgerService) {}

  // ==========================================
  // CHART OF ACCOUNTS
  // ==========================================

  @Post('accounts')
  @HttpCode(HttpStatus.CREATED)
  async createAccount(@Req() req: RequestWithUser, @Body() dto: CreateAccountDto) {
    return this.ledgerService.createAccount(req.user, dto);
  }

  @Get('accounts')
  async findAllAccounts(
    @Req() req: RequestWithUser,
    @Query() query: AccountQueryDto,
  ) {
    return this.ledgerService.findAllAccounts(req.user, query);
  }

  @Get('accounts/:id')
  async findAccountById(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.ledgerService.findAccountById(req.user, id);
  }

  // ==========================================
  // JOURNAL ENTRIES
  // ==========================================

  @Post('journal-entries')
  @HttpCode(HttpStatus.CREATED)
  async createJournalEntry(
    @Req() req: RequestWithUser,
    @Body() dto: CreateJournalEntryDto,
  ) {
    return this.ledgerService.createJournalEntry(req.user, dto);
  }

  @Get('journal-entries')
  async findAllEntries(
    @Req() req: RequestWithUser,
    @Query() query: JournalQueryDto,
  ) {
    return this.ledgerService.findAllEntries(req.user, query);
  }

  @Get('journal-entries/:id')
  async findEntryById(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.ledgerService.findEntryById(req.user, id);
  }

  @Post('journal-entries/:id/post')
  @HttpCode(HttpStatus.OK)
  async postDraftEntry(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.ledgerService.postDraftEntry(req.user, id);
  }

  @Post('journal-entries/:id/void')
  @HttpCode(HttpStatus.OK)
  async voidJournalEntry(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto?: VoidJournalEntryDto,
  ) {
    return this.ledgerService.voidJournalEntry(req.user, id, dto);
  }
}
