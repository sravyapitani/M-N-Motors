import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { FinanceFundingService } from './finance-funding.service';
import { CreateFundingDrawDto } from './dto/create-funding-draw.dto';
import { UpdateFundingDrawDto } from './dto/update-funding-draw.dto';
import { CreateFundingRepaymentDto } from './dto/create-funding-repayment.dto';
import { FundingQueryDto } from './dto/funding-query.dto';

interface RequestWithUser {
    user: AuthenticatedUser;
}

@Controller('finance/funding')
@UseGuards(JwtAuthGuard)
export class FinanceFundingController {
    constructor(private readonly fundingService: FinanceFundingService) {}

    /**
     * GET /api/finance/funding/facilities
     * List all credit and inventory funding facilities with real-time utilisation.
     */
    @Get('facilities')
    async getFacilities(@Req() req: RequestWithUser) {
        this.fundingService.verifyCcViewAccess(req.user);
        return this.fundingService.getFacilities();
    }

    /**
     * GET /api/finance/funding/facilities/summary
     * Overall facilities summary cards.
     */
    @Get('facilities/summary')
    async getSummary(@Req() req: RequestWithUser) {
        this.fundingService.verifyCcViewAccess(req.user);
        return this.fundingService.getSummary();
    }

    /**
     * GET /api/finance/funding/draws
     * Query and paginate funding draws.
     */
    @Get('draws')
    async getDraws(
        @Req() req: RequestWithUser,
        @Query() query: FundingQueryDto,
    ) {
        this.fundingService.verifyCcViewAccess(req.user);
        return this.fundingService.getDraws(query);
    }

    /**
     * GET /api/finance/funding/draws/:id
     * Single draw details with repayments and audit trail history.
     */
    @Get('draws/:id')
    async getDrawById(
        @Req() req: RequestWithUser,
        @Param('id') id: string,
    ) {
        this.fundingService.verifyCcViewAccess(req.user);
        return this.fundingService.getDrawById(id);
    }

    /**
     * POST /api/finance/funding/draws
     * Record a new draw on a facility.
     */
    @Post('draws')
    @HttpCode(HttpStatus.CREATED)
    async createDraw(
        @Req() req: RequestWithUser,
        @Body() dto: CreateFundingDrawDto,
    ) {
        this.fundingService.verifyCcManageAccess(req.user);
        return this.fundingService.createDraw(req.user, dto);
    }

    /**
     * PATCH /api/finance/funding/draws/:id
     * Update draw details and record audit log.
     */
    @Patch('draws/:id')
    async updateDraw(
        @Req() req: RequestWithUser,
        @Param('id') id: string,
        @Body() dto: UpdateFundingDrawDto,
    ) {
        this.fundingService.verifyCcManageAccess(req.user);
        return this.fundingService.updateDraw(req.user, id, dto);
    }

    /**
     * POST /api/finance/funding/draws/:id/repayments
     * Record a repayment against a draw.
     */
    @Post('draws/:id/repayments')
    @HttpCode(HttpStatus.CREATED)
    async recordRepayment(
        @Req() req: RequestWithUser,
        @Param('id') id: string,
        @Body() dto: CreateFundingRepaymentDto,
    ) {
        this.fundingService.verifyCcManageAccess(req.user);
        return this.fundingService.recordRepayment(req.user, id, dto);
    }

    /**
     * GET /api/finance/funding/alerts
     * Real-time reminder alerts for draws due soon or overdue.
     */
    @Get('alerts')
    async getAlerts(@Req() req: RequestWithUser) {
        this.fundingService.verifyCcViewAccess(req.user);
        return this.fundingService.getAlerts();
    }
}
