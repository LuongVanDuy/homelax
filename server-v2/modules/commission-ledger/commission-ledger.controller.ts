import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  commissionCalculationRequestSchema,
  commissionExceptionResolutionRequestSchema,
  commissionHistoryBoundarySchema,
  commissionHistoryPageSchema,
  commissionHistoryQuerySchema,
  commissionMonthlyStatementQuerySchema,
  commissionMonthlyStatementSchema,
  commissionLedgerBoundarySchema,
  commissionLedgerNullableSchema,
  commissionPayoutBoundarySchema,
  type CommissionCalculationRequest,
  type CommissionExceptionResolutionRequest,
  type CommissionHistoryQuery,
  type CommissionMonthlyStatementQuery,
} from '@tinyhouse/contracts';
import { Roles } from '../../common/auth/auth.decorators.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AppIdentity } from '../../common/auth/auth.types.js';
import { ApiStandardErrors, ApiZodBody, ApiZodOk } from '../../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PostgresService } from '../../database/postgres.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CommissionLedgerService } from './commission-ledger.service.js';

@ApiTags('commission-ledger')
@ApiBearerAuth()
@ApiStandardErrors()
@Roles('admin', 'superadmin')
@Controller('commission-ledger')
export class CommissionLedgerController {
  constructor(
    private readonly ledger: CommissionLedgerService,
    private readonly db: PostgresService,
    private readonly audit: AuditService,
  ) {}

  @Get('boundary')
  @ApiOperation({ summary: 'A03/A04 commission ledger boundary with QA03 eligibility and admin exception resolution' })
  @ApiZodOk(commissionLedgerBoundarySchema, 'Commission ledger boundary')
  boundary() {
    return this.ledger.boundary();
  }

  @Get('history-boundary')
  @Roles('admin', 'superadmin', 'commission_accountant', 'ctv_sale')
  @ApiOperation({ summary: 'U07.4 history/monthly-statement boundary with D09 canonical month axis/timezone' })
  @ApiZodOk(commissionHistoryBoundarySchema, 'Commission history boundary')
  historyBoundary() {
    return this.ledger.historyBoundary();
  }

  @Get('history')
  @Roles('admin', 'superadmin', 'commission_accountant', 'ctv_sale')
  @ApiZodOk(commissionHistoryPageSchema, 'Paged commission and closed-room history')
  history(
    @CurrentUser() actor: AppIdentity,
    @Query(new ZodValidationPipe(commissionHistoryQuerySchema)) query: CommissionHistoryQuery,
  ) {
    return this.ledger.history(actor, query);
  }

  @Get('monthly-statement')
  @Roles('admin', 'superadmin', 'commission_accountant', 'ctv_sale')
  @ApiQuery({ name: 'month', required: true, schema: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' } })
  @ApiZodOk(commissionMonthlyStatementSchema, 'Monthly commission statement using canonical D09 month axis')
  monthlyStatement(
    @CurrentUser() actor: AppIdentity,
    @Query(new ZodValidationPipe(commissionMonthlyStatementQuerySchema)) query: CommissionMonthlyStatementQuery,
  ) {
    return this.ledger.monthlyStatement(actor, query);
  }

  @Get('payout-boundary')
  @Roles('admin', 'superadmin', 'commission_accountant', 'ctv_sale')
  @ApiOperation({ summary: 'A05 dual approval and payout-cycle boundary; transfer remains external/manual' })
  @ApiZodOk(commissionPayoutBoundarySchema, 'Commission payout boundary')
  payoutBoundary() {
    return this.ledger.payoutBoundary();
  }

  @Patch('entries/:ledgerId/calculation')
  @HttpCode(200)
  @ApiOperation({ summary: 'A03 calculate CTV payable from Admin-entered X, 10% tax, 90% pool and allocation snapshot' })
  @ApiZodBody(commissionCalculationRequestSchema)
  @ApiZodOk(commissionLedgerNullableSchema, 'Calculated A03 commission ledger')
  async calculate(
    @Param('ledgerId') ledgerId: string,
    @Body(new ZodValidationPipe(commissionCalculationRequestSchema)) body: CommissionCalculationRequest,
    @CurrentUser() actor: AppIdentity,
  ) {
    const ledger = await this.ledger.calculate(actor, ledgerId, body);
    await this.audit.create({
      user: actor,
      action: 'UPDATE',
      entityType: 'commission_calculation',
      entityId: ledgerId,
      summary: `${actor.name || 'Admin'} đã tính hoa hồng A03 cho ${ledgerId}`,
      metadata: {
        grossCommissionX: ledger.grossCommissionX,
        taxAmount: ledger.taxAmount,
        allocationPool: ledger.allocationPool,
        ctvBaseAmount: ledger.ctvBaseAmount,
        ctvBonusAmount: ledger.ctvBonusAmount,
        commissionAmount: ledger.commissionAmount,
      },
    }).catch(() => undefined);
    return ledger;
  }

  @Patch('entries/:ledgerId/exception-resolution')
  @HttpCode(200)
  @ApiOperation({
    summary: 'A04 resolve cancelled/forfeit commission case using Admin-entered retained X and the A03 formula',
  })
  @ApiZodBody(commissionExceptionResolutionRequestSchema)
  @ApiZodOk(commissionLedgerNullableSchema, 'Resolved A04 commission exception')
  async resolveException(
    @Param('ledgerId') ledgerId: string,
    @Body(new ZodValidationPipe(commissionExceptionResolutionRequestSchema)) body: CommissionExceptionResolutionRequest,
    @CurrentUser() actor: AppIdentity,
  ) {
    const result = await this.ledger.resolveException(actor, ledgerId, body);
    await this.audit.create({
      user: actor,
      action: 'UPDATE',
      entityType: 'commission_exception_resolution',
      entityId: ledgerId,
      summary: `${actor.name || 'Admin'} đã xử lý case hủy/bỏ cọc cho khoản hoa hồng ${ledgerId}`,
      metadata: {
        sequence: result.event.sequence,
        sourceReviewReason: result.event.sourceReviewReason,
        resolutionReason: result.event.resolutionReason,
        allocationSource: result.event.allocationSource,
        beforeGrossCommissionX: result.event.before?.grossCommissionX ?? null,
        afterGrossCommissionX: result.event.after.grossCommissionX,
        beforeCommissionAmount: result.event.before?.commissionAmount ?? null,
        afterCommissionAmount: result.event.after.commissionAmount,
      },
    }).catch(() => undefined);
    return result.ledger;
  }

  @Post('entries/:ledgerId/admin-approval')
  @HttpCode(200)
  @Roles('admin', 'superadmin')
  @ApiOperation({ summary: 'A05 Admin approval for one resolved commission payout' })
  @ApiZodOk(commissionLedgerNullableSchema, 'Admin-approved payout state')
  async approveAdmin(
    @Param('ledgerId') ledgerId: string,
    @CurrentUser() actor: AppIdentity,
  ) {
    const result = await this.ledger.approvePayout(actor, ledgerId, 'admin');
    await this.audit.create({
      user: actor,
      action: 'UPDATE',
      entityType: 'commission_payout_approval',
      entityId: ledgerId,
      summary: `${actor.name || 'Admin'} đã duyệt thanh toán khoản hoa hồng ${ledgerId}`,
      metadata: {
        approvalKind: 'admin',
        action: result.action,
        dualApprovalComplete: result.ledger.dualApprovalComplete,
        payoutReadyAt: result.ledger.payoutReadyAt,
        payoutCycleDate: result.ledger.payoutCycleDate,
      },
    }).catch(() => undefined);
    return result.ledger;
  }

  @Post('entries/:ledgerId/accountant-approval')
  @HttpCode(200)
  @Roles('commission_accountant')
  @ApiOperation({ summary: 'A05 Commission Accountant approval for one resolved commission payout' })
  @ApiZodOk(commissionLedgerNullableSchema, 'Accountant-approved payout state')
  async approveAccountant(
    @Param('ledgerId') ledgerId: string,
    @CurrentUser() actor: AppIdentity,
  ) {
    const result = await this.ledger.approvePayout(actor, ledgerId, 'accountant');
    await this.audit.create({
      user: actor,
      action: 'UPDATE',
      entityType: 'commission_payout_approval',
      entityId: ledgerId,
      summary: `${actor.name || 'Kế toán'} đã duyệt thanh toán khoản hoa hồng ${ledgerId}`,
      metadata: {
        approvalKind: 'accountant',
        action: result.action,
        dualApprovalComplete: result.ledger.dualApprovalComplete,
        payoutReadyAt: result.ledger.payoutReadyAt,
        payoutCycleDate: result.ledger.payoutCycleDate,
      },
    }).catch(() => undefined);
    return result.ledger;
  }

  @Post('entries/:ledgerId/withdrawal-request')
  @HttpCode(200)
  @Roles('ctv_sale')
  @ApiZodOk(commissionLedgerNullableSchema, 'CTV withdrawal request state')
  async requestWithdrawal(
    @Param('ledgerId') ledgerId: string,
    @CurrentUser() actor: AppIdentity,
  ) {
    const result = await this.ledger.requestWithdrawal(actor, ledgerId);
    await this.audit.create({
      user: actor,
      action: 'UPDATE',
      entityType: 'commission_payout',
      entityId: ledgerId,
      summary: `${actor.name || 'CTV'} đã yêu cầu rút khoản hoa hồng ${ledgerId}`,
      metadata: { action: result.action, paymentStatus: result.ledger.paymentStatus },
    }).catch(() => undefined);
    return result.ledger;
  }

  @Post('entries/:ledgerId/mark-paid')
  @HttpCode(200)
  @Roles('admin', 'superadmin')
  @ApiOperation({ summary: 'A05 confirm external payment after both approvals and payout cycle is due' })
  @ApiZodOk(commissionLedgerNullableSchema, 'A05 external payment confirmation state')
  async markPaid(
    @Param('ledgerId') ledgerId: string,
    @CurrentUser() actor: AppIdentity,
  ) {
    const result = await this.ledger.markPaid(actor, ledgerId);
    await this.audit.create({
      user: actor,
      action: 'UPDATE',
      entityType: 'commission_payout',
      entityId: ledgerId,
      summary: `${actor.name || 'Admin'} đã xác nhận thanh toán khoản hoa hồng ${ledgerId}`,
      metadata: { action: result.action, paymentStatus: result.ledger.paymentStatus },
    }).catch(() => undefined);
    return result.ledger;
  }

  @Get('deals/:dealId')
  @ApiZodOk(commissionLedgerNullableSchema, 'Commission ledger for a Deal')
  detail(@Param('dealId') dealId: string) {
    return this.ledger.detailByDeal(dealId);
  }

  @Post('deals/:dealId/reconcile')
  @HttpCode(200)
  @ApiOperation({ summary: 'Idempotently reconcile one eligible Deal into the canonical U07.3 ledger' })
  @ApiZodOk(commissionLedgerNullableSchema, 'Reconciled commission ledger for a Deal')
  async reconcile(
    @Param('dealId') dealId: string,
    @CurrentUser() actor: AppIdentity,
  ) {
    const result = await this.db.transaction((client) =>
      this.ledger.ensureForEligibleDeal(client, dealId));

    await this.audit.create({
      user: actor,
      action: 'UPDATE',
      entityType: 'commission_ledger',
      entityId: dealId,
      summary: `${actor?.name || 'Admin'} đã đối chiếu commission ledger cho Deal ${dealId}`,
      metadata: {
        action: result.action,
        ledgerId: result.ledger?.id || null,
        status: result.ledger?.status || null,
      },
    }).catch(() => undefined);

    return result.ledger;
  }
}
