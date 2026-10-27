import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import crypto from 'crypto';
import {
  COMMISSION_HISTORY_BOUNDARY,
  COMMISSION_LEDGER_BOUNDARY,
  COMMISSION_PAYOUT_BOUNDARY,
  commissionPayoutCycleDateForReadyAt,
  commissionVietnamDate,
  type CommissionCalculationRequest,
  type CommissionExceptionResolutionRequest,
  type CommissionHistoryQuery,
  type CommissionMonthlyStatementQuery,
  type CommissionLedgerStatus,
  type CommissionPaymentStatus,
} from '@tinyhouse/contracts';
import type { PoolClient, QueryResultRow } from 'pg';
import type { AppIdentity } from '../../common/auth/auth.types.js';
import { escapedLike, pageOffset, pageResult } from '../../common/list/list-utils.js';
import { PostgresService } from '../../database/postgres.service.js';

type DealSnapshotRow = QueryResultRow & {
  id: string;
  customer_id: string;
  collaborator_id: string | null;
  source_type: string | null;
  source_channel: string | null;
  source_recorded_at: Date | string | null;
  room_unit_id: string;
  final_price: string | number;
  contract_signed_at: Date | string | null;
  deposit_required_amount: string | number | null;
  deposit_paid_amount: string | number | null;
  lifecycle_status: string;
  collaborator_name: string | null;
  collaborator_type_id: string | null;
  collaborator_type_name: string | null;
  room_unit_code: string | null;
};

function iso(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapAllocationSnapshot(value: unknown) {
  return (Array.isArray(value) ? value : []).map((item: any) => ({
    targetId: String(item?.targetId || ''),
    targetName: String(item?.targetName || ''),
    targetKind: item?.targetKind === 'department' ? 'department' as const : 'position' as const,
    percentage: Number(item?.percentage || 0),
    amount: Number(item?.amount || 0),
    isCtv: Boolean(item?.isCtv),
  })).filter((item: { targetId: string }) => Boolean(item.targetId));
}

function calculationFacts(row: Record<string, any>) {
  if (row.gross_commission_x === null || row.gross_commission_x === undefined) return null;
  const ctvTargetId = row.ctv_allocation_target_id ? String(row.ctv_allocation_target_id) : '';
  if (!ctvTargetId) return null;
  return {
    grossCommissionX: Number(row.gross_commission_x || 0),
    taxRateSnapshot: Number(row.tax_rate_snapshot || 0),
    taxAmount: Number(row.tax_amount || 0),
    allocationPool: Number(row.allocation_pool || 0),
    allocationSnapshot: mapAllocationSnapshot(row.allocation_snapshot),
    ctvAllocationTargetId: ctvTargetId,
    ctvAllocationTargetNameSnapshot: String(row.ctv_allocation_target_name_snapshot || ''),
    ctvPercentageSnapshot: Number(row.ctv_percentage_snapshot || 0),
    ctvBaseAmount: Number(row.ctv_base_amount || 0),
    ctvBonusAmount: Number(row.ctv_bonus_amount || 0),
    commissionAmount: Number(row.commission_amount || 0),
  };
}

function mapExceptionHistory(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item: any) => ({
    sequence: Number(item?.sequence || 0),
    sourceReviewReason: String(item?.sourceReviewReason || ''),
    resolutionReason: String(item?.resolutionReason || ''),
    allocationSource: item?.allocationSource === 'previous_snapshot'
      ? 'previous_snapshot' as const
      : 'current_config' as const,
    resolvedAt: String(item?.resolvedAt || ''),
    resolvedByUserId: String(item?.resolvedByUserId || ''),
    before: item?.before || null,
    after: item?.after || {},
  })).filter((item: { sequence: number; resolvedAt: string; resolvedByUserId: string }) =>
    item.sequence > 0 && Boolean(item.resolvedAt) && Boolean(item.resolvedByUserId));
}

function isA04ReviewReason(value: unknown) {
  const reasons = String(value || '').split(';').map((item) => item.trim()).filter(Boolean);
  return reasons.includes('deal_cancelled') || reasons.includes('contract_deposit_completion_reversed');
}

function dateOnly(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return [
      String(value.getFullYear()).padStart(4, '0'),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0'),
    ].join('-');
  }
  const text = String(value);
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  return null;
}

function mapLedger(row: Record<string, any>) {
  const paymentStatus = String(row.payment_status || 'unpaid') as CommissionPaymentStatus;
  const adminApprovedAt = iso(row.admin_approved_at);
  const accountantApprovedAt = iso(row.accountant_approved_at);
  const dualApprovalComplete = Boolean(adminApprovedAt && accountantApprovedAt);
  const payoutCycleDate = dateOnly(row.payout_cycle_date);
  const payoutDue = paymentStatus === 'unpaid'
    && dualApprovalComplete
    && Boolean(payoutCycleDate)
    && commissionVietnamDate(new Date()) >= String(payoutCycleDate);
  return {
    id: String(row.id || ''),
    dealId: String(row.deal_id || ''),
    customerId: String(row.customer_id || ''),
    collaboratorId: row.collaborator_id ? String(row.collaborator_id) : null,
    collaboratorNameSnapshot: String(row.collaborator_name_snapshot || ''),
    collaboratorTypeId: row.collaborator_type_id ? String(row.collaborator_type_id) : null,
    collaboratorTypeNameSnapshot: String(row.collaborator_type_name_snapshot || ''),
    roomUnitId: String(row.room_unit_id || ''),
    roomUnitCodeSnapshot: String(row.room_unit_code_snapshot || ''),
    finalPriceSnapshot: Number(row.final_price_snapshot || 0),
    sourceTypeSnapshot: String(row.source_type_snapshot || ''),
    sourceChannelSnapshot: String(row.source_channel_snapshot || ''),
    sourceRecordedAtSnapshot: iso(row.source_recorded_at_snapshot),
    grossCommissionX: row.gross_commission_x === null || row.gross_commission_x === undefined ? null : Number(row.gross_commission_x),
    taxRateSnapshot: row.tax_rate_snapshot === null || row.tax_rate_snapshot === undefined ? null : Number(row.tax_rate_snapshot),
    taxAmount: row.tax_amount === null || row.tax_amount === undefined ? null : Number(row.tax_amount),
    allocationPool: row.allocation_pool === null || row.allocation_pool === undefined ? null : Number(row.allocation_pool),
    allocationSnapshot: mapAllocationSnapshot(row.allocation_snapshot),
    ctvAllocationTargetId: row.ctv_allocation_target_id ? String(row.ctv_allocation_target_id) : null,
    ctvAllocationTargetNameSnapshot: String(row.ctv_allocation_target_name_snapshot || ''),
    ctvPercentageSnapshot: row.ctv_percentage_snapshot === null || row.ctv_percentage_snapshot === undefined ? null : Number(row.ctv_percentage_snapshot),
    ctvBaseAmount: row.ctv_base_amount === null || row.ctv_base_amount === undefined ? null : Number(row.ctv_base_amount),
    ctvBonusAmount: row.ctv_bonus_amount === null || row.ctv_bonus_amount === undefined ? null : Number(row.ctv_bonus_amount),
    commissionAmount: row.commission_amount === null || row.commission_amount === undefined ? null : Number(row.commission_amount),
    calculatedAt: iso(row.calculated_at),
    calculatedByUserId: row.calculated_by_user_id ? String(row.calculated_by_user_id) : null,
    exceptionResolutionCount: Number(row.exception_resolution_count || 0),
    exceptionResolutionReason: String(row.exception_resolution_reason || ''),
    exceptionAllocationSource: (
      row.exception_allocation_source === 'previous_snapshot'
        ? 'previous_snapshot'
        : row.exception_allocation_source === 'current_config'
          ? 'current_config'
          : ''
    ) as '' | 'previous_snapshot' | 'current_config',
    exceptionResolvedAt: iso(row.exception_resolved_at),
    exceptionResolvedByUserId: row.exception_resolved_by_user_id ? String(row.exception_resolved_by_user_id) : null,
    exceptionResolutionHistory: mapExceptionHistory(row.exception_resolution_history),
    status: String(row.status || 'blocked_no_collaborator') as CommissionLedgerStatus,
    paymentStatus,
    adminApprovedAt,
    adminApprovedByUserId: row.admin_approved_by_user_id ? String(row.admin_approved_by_user_id) : null,
    accountantApprovedAt,
    accountantApprovedByUserId: row.accountant_approved_by_user_id ? String(row.accountant_approved_by_user_id) : null,
    dualApprovalComplete,
    payoutReadyAt: iso(row.payout_ready_at),
    payoutCycleDate,
    payoutDue,
    withdrawalRequestedAt: iso(row.withdrawal_requested_at),
    withdrawalRequestedByUserId: row.withdrawal_requested_by_user_id ? String(row.withdrawal_requested_by_user_id) : null,
    paidAt: iso(row.paid_at),
    paidByUserId: row.paid_by_user_id ? String(row.paid_by_user_id) : null,
    reviewRequired: Boolean(row.review_required),
    reviewReason: String(row.review_reason || ''),
    eligibleAt: iso(row.eligible_at) || new Date(0).toISOString(),
    createdAt: iso(row.created_at) || new Date(0).toISOString(),
    updatedAt: iso(row.updated_at) || new Date(0).toISOString(),
  };
}

function mapHistory(row: Record<string, any>) {
  return {
    ...mapLedger(row),
    customerName: String(row.customer_name || ''),
    buildingCode: String(row.building_code || ''),
    buildingName: String(row.building_name || ''),
    roomTypeName: String(row.room_type_name || ''),
    dealLifecycleStatus: row.deal_lifecycle_status === 'cancelled' ? 'cancelled' as const : 'active' as const,
  };
}

function monthBounds(month: string) {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  return {
    monthStartLocal: `${month}-01T00:00:00`,
    nextMonthStartLocal: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00`,
  };
}

@Injectable()
export class CommissionLedgerService {
  constructor(private readonly db: PostgresService) {}

  boundary() {
    return COMMISSION_LEDGER_BOUNDARY;
  }

  historyBoundary() {
    return COMMISSION_HISTORY_BOUNDARY;
  }

  payoutBoundary() {
    return COMMISSION_PAYOUT_BOUNDARY;
  }

  private async collaboratorScope(identity: AppIdentity) {
    const role = String(identity.roleCode || '').toLowerCase();
    if (role === 'admin' || role === 'superadmin' || role === 'commission_accountant') {
      return { mode: 'all' as const, collaboratorId: '' };
    }
    const result = await this.db.query<{ id: string } & QueryResultRow>(
      `
        SELECT id
        FROM collaborators
        WHERE user_id = $1
          AND archived_at IS NULL
        LIMIT 1
      `,
      [identity.id],
    );
    return { mode: 'self' as const, collaboratorId: String(result.rows[0]?.id || '') };
  }

  async history(identity: AppIdentity, query: CommissionHistoryQuery) {
    const scope = await this.collaboratorScope(identity);
    if (scope.mode === 'self' && !scope.collaboratorId) {
      return pageResult([], query.page, query.pageSize, 0);
    }

    const search = query.search.trim();
    const pattern = escapedLike(search);
    const sortColumn = {
      eligibleAt: 'l.eligible_at',
      createdAt: 'l.created_at',
      roomUnitCode: 'lower(l.room_unit_code_snapshot)',
      collaboratorName: 'lower(l.collaborator_name_snapshot)',
    }[query.sort] || 'l.eligible_at';
    const order = query.order === 'asc' ? 'ASC' : 'DESC';
    const requestedCollaboratorId = scope.mode === 'all' ? query.collaboratorId : scope.collaboratorId;
    const joins = `
      FROM commission_ledger_entries l
      JOIN deals d ON d.id = l.deal_id
      LEFT JOIN customers customer ON customer.id = l.customer_id
      LEFT JOIN room_units unit ON unit.id = l.room_unit_id
      LEFT JOIN rooms room ON room.id = unit.room_type_id
      LEFT JOIN buildings building ON building.id = unit.building_id
    `;
    const where = `
      WHERE ($1 = 'all' OR l.collaborator_id = $2)
        AND ($3 = '' OR l.collaborator_id = $3)
        AND ($4 = '' OR l.status = $4)
        AND (
          $5 = ''
          OR ($5 = 'required' AND l.review_required = TRUE)
          OR ($5 = 'clear' AND l.review_required = FALSE)
        )
        AND (
          $8 = ''
          OR (
            $8 = 'actionRequired'
            AND (
              l.review_required = TRUE
              OR l.status <> 'eligible_pending_amount'
              OR l.commission_amount IS NULL
              OR (
                l.payment_status = 'unpaid'
                AND l.commission_amount > 0
                AND (
                  l.admin_approved_at IS NULL
                  OR l.accountant_approved_at IS NULL
                )
              )
            )
          )
          OR (
            $8 = 'unpaid'
            AND l.status = 'eligible_pending_amount'
            AND l.review_required = FALSE
            AND l.commission_amount IS NOT NULL
            AND l.commission_amount > 0
            AND l.payment_status = 'unpaid'
          )
          OR ($8 = 'paid' AND l.payment_status = 'paid')
        )
        AND (
          $6 = ''
          OR l.id ILIKE $7
          OR l.deal_id ILIKE $7
          OR l.customer_id ILIKE $7
          OR COALESCE(customer.name, '') ILIKE $7
          OR l.collaborator_name_snapshot ILIKE $7
          OR l.collaborator_type_name_snapshot ILIKE $7
          OR l.room_unit_code_snapshot ILIKE $7
          OR COALESCE(building.code, '') ILIKE $7
          OR COALESCE(building.name, '') ILIKE $7
          OR COALESCE(room.type, '') ILIKE $7
        )
    `;
    const params = [
      scope.mode,
      scope.collaboratorId,
      requestedCollaboratorId,
      query.status,
      query.review,
      search,
      pattern,
      query.workflow,
    ];
    const [rows, count] = await Promise.all([
      this.db.query(
        `
          SELECT l.*,
            COALESCE(customer.name, '') AS customer_name,
            COALESCE(building.code, '') AS building_code,
            COALESCE(building.name, '') AS building_name,
            COALESCE(room.type, '') AS room_type_name,
            d.lifecycle_status AS deal_lifecycle_status
          ${joins}
          ${where}
          ORDER BY ${sortColumn} ${order}, l.id DESC
          LIMIT $9 OFFSET $10
        `,
        [...params, query.pageSize, pageOffset(query.page, query.pageSize)],
      ),
      this.db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count ${joins} ${where}`,
        params,
      ),
    ]);
    return pageResult(
      rows.rows.map(mapHistory),
      query.page,
      query.pageSize,
      Number(count.rows[0]?.count || 0),
    );
  }

  async monthlyStatement(identity: AppIdentity, query: CommissionMonthlyStatementQuery) {
    const scope = await this.collaboratorScope(identity);
    const bounds = monthBounds(query.month);
    if (scope.mode === 'self' && !scope.collaboratorId) {
      return {
        month: query.month,
        timezone: 'Asia/Ho_Chi_Minh' as const,
        ...bounds,
        summary: {
          closedRoomCount: 0,
          reviewRequiredCount: 0,
          resolvedAmountCount: 0,
          pendingAmountCount: 0,
          resolvedCommissionTotal: 0,
          paidCount: 0,
          unpaidCount: 0,
          withdrawalRequestedCount: 0,
        },
        ...pageResult([], query.page, query.pageSize, 0),
      };
    }

    const joins = `
      FROM commission_ledger_entries l
      JOIN deals d ON d.id = l.deal_id
      LEFT JOIN customers customer ON customer.id = l.customer_id
      LEFT JOIN room_units unit ON unit.id = l.room_unit_id
      LEFT JOIN rooms room ON room.id = unit.room_type_id
      LEFT JOIN buildings building ON building.id = unit.building_id
    `;
    const requestedCollaboratorId = scope.mode === 'all' ? query.collaboratorId : scope.collaboratorId;
    const where = `
      WHERE ($1 = 'all' OR l.collaborator_id = $2)
        AND ($3 = '' OR l.collaborator_id = $3)
        AND (l.eligible_at AT TIME ZONE 'Asia/Ho_Chi_Minh') >= $4::timestamp
        AND (l.eligible_at AT TIME ZONE 'Asia/Ho_Chi_Minh') < $5::timestamp
    `;
    const params = [
      scope.mode,
      scope.collaboratorId,
      requestedCollaboratorId,
      bounds.monthStartLocal,
      bounds.nextMonthStartLocal,
    ];
    const [rows, summary] = await Promise.all([
      this.db.query(
        `
          SELECT l.*,
            COALESCE(customer.name, '') AS customer_name,
            COALESCE(building.code, '') AS building_code,
            COALESCE(building.name, '') AS building_name,
            COALESCE(room.type, '') AS room_type_name,
            d.lifecycle_status AS deal_lifecycle_status
          ${joins}
          ${where}
          ORDER BY l.eligible_at DESC, l.id DESC
          LIMIT $6 OFFSET $7
        `,
        [...params, query.pageSize, pageOffset(query.page, query.pageSize)],
      ),
      this.db.query<{
        closed_room_count: number;
        review_required_count: number;
        resolved_amount_count: number;
        pending_amount_count: number;
        resolved_commission_total: string | number;
        paid_count: number;
        unpaid_count: number;
        withdrawal_requested_count: number;
      } & QueryResultRow>(
        `
          SELECT
            COUNT(*)::int AS closed_room_count,
            COUNT(*) FILTER (WHERE l.review_required = TRUE)::int AS review_required_count,
            COUNT(*) FILTER (WHERE l.commission_amount IS NOT NULL)::int AS resolved_amount_count,
            COUNT(*) FILTER (WHERE l.commission_amount IS NULL)::int AS pending_amount_count,
            COALESCE(SUM(l.commission_amount) FILTER (WHERE l.commission_amount IS NOT NULL), 0) AS resolved_commission_total,
            COUNT(*) FILTER (WHERE l.payment_status = 'paid')::int AS paid_count,
            COUNT(*) FILTER (WHERE l.payment_status = 'unpaid')::int AS unpaid_count,
            COUNT(*) FILTER (WHERE l.withdrawal_requested_at IS NOT NULL)::int AS withdrawal_requested_count
          ${joins}
          ${where}
        `,
        params,
      ),
    ]);
    const aggregate = summary.rows[0];
    const total = Number(aggregate?.closed_room_count || 0);
    return {
      month: query.month,
      timezone: 'Asia/Ho_Chi_Minh' as const,
      ...bounds,
      summary: {
        closedRoomCount: total,
        reviewRequiredCount: Number(aggregate?.review_required_count || 0),
        resolvedAmountCount: Number(aggregate?.resolved_amount_count || 0),
        pendingAmountCount: Number(aggregate?.pending_amount_count || 0),
        resolvedCommissionTotal: Number(aggregate?.resolved_commission_total || 0),
        paidCount: Number(aggregate?.paid_count || 0),
        unpaidCount: Number(aggregate?.unpaid_count || 0),
        withdrawalRequestedCount: Number(aggregate?.withdrawal_requested_count || 0),
      },
      ...pageResult(rows.rows.map(mapHistory), query.page, query.pageSize, total),
    };
  }

  async detailByDeal(dealId: string) {
    const result = await this.db.query(
      'SELECT * FROM commission_ledger_entries WHERE deal_id = $1 LIMIT 1',
      [dealId],
    );
    return result.rows[0] ? mapLedger(result.rows[0]) : null;
  }

  async calculate(
    actor: AppIdentity,
    ledgerId: string,
    data: CommissionCalculationRequest,
  ) {
    return this.db.transaction(async (client) => {
      const current = await client.query(
        `SELECT * FROM commission_ledger_entries WHERE id = $1 FOR UPDATE`,
        [ledgerId],
      );
      const row = current.rows[0];
      if (!row) throw new NotFoundException({ error: 'Không tìm thấy khoản hoa hồng.' });
      if (row.payment_status === 'paid') {
        throw new ConflictException({ error: 'Khoản hoa hồng đã thanh toán không thể tính lại ở A03.' });
      }
      if (row.withdrawal_requested_at) {
        throw new ConflictException({ error: 'Khoản hoa hồng đã có yêu cầu rút tiền nên không thể thay đổi số tiền.' });
      }
      if (
        row.admin_approved_at
        || row.accountant_approved_at
        || row.payout_ready_at
        || row.payout_cycle_date
      ) {
        throw new ConflictException({
          error: 'Khoản hoa hồng đã bắt đầu quy trình duyệt thanh toán nên không thể tính lại số tiền.',
        });
      }
      if (row.review_required) {
        throw new ConflictException({ error: 'Khoản hoa hồng đang cần rà soát nên chưa thể tính lại.' });
      }
      if (!row.collaborator_id || row.status === 'blocked_no_collaborator') {
        throw new ConflictException({ error: 'Deal chưa có CTV nên chưa thể tính hoa hồng CTV.' });
      }

      const targets = await client.query<{
        id: string;
        name: string;
        target_kind: 'department' | 'position';
        percentage: string | number;
        is_ctv: boolean;
      } & QueryResultRow>(
        `SELECT id, name, target_kind, percentage, is_ctv
         FROM commission_allocation_targets
         WHERE is_active = TRUE
         ORDER BY is_ctv DESC, target_kind, lower(name), id
         FOR SHARE`,
      );
      const totalRate = targets.rows.reduce((sum, target) => sum + Number(target.percentage || 0), 0);
      const ctvTargets = targets.rows.filter((target) => target.is_ctv);
      if (Math.abs(totalRate - 100) >= 0.0001 || ctvTargets.length !== 1) {
        throw new BadRequestException({
          error: 'Cơ cấu phân bổ phải có tổng tỷ lệ đúng 100% và đúng một vị trí CTV đang hoạt động trước khi tính.',
        });
      }

      const gross = Number(data.grossCommissionX);
      const taxRate = 10;
      const taxAmount = gross * taxRate / 100;
      const pool = gross - taxAmount;
      const allocationSnapshot = targets.rows.map((target) => ({
        targetId: target.id,
        targetName: target.name || '',
        targetKind: target.target_kind,
        percentage: Number(target.percentage || 0),
        amount: pool * Number(target.percentage || 0) / 100,
        isCtv: Boolean(target.is_ctv),
      }));
      const ctvTarget = ctvTargets[0];
      const ctvRate = Number(ctvTarget.percentage || 0);
      const ctvBaseAmount = pool * ctvRate / 100;
      const ctvBonusAmount = Number(data.ctvBonus || 0);
      const commissionAmount = ctvBaseAmount + ctvBonusAmount;

      const updated = await client.query(
        `
          UPDATE commission_ledger_entries
          SET gross_commission_x = $2,
              tax_rate_snapshot = $3,
              tax_amount = $4,
              allocation_pool = $5,
              allocation_snapshot = $6::jsonb,
              ctv_allocation_target_id = $7,
              ctv_allocation_target_name_snapshot = $8,
              ctv_percentage_snapshot = $9,
              ctv_base_amount = $10,
              ctv_bonus_amount = $11,
              commission_amount = $12,
              calculated_at = NOW(),
              calculated_by_user_id = $13,
              policy_id = NULL,
              policy_percentage_snapshot = NULL,
              policy_amount_6_months_snapshot = NULL,
              policy_amount_12_months_snapshot = NULL,
              selected_contract_months = NULL,
              status = 'eligible_pending_amount',
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [
          ledgerId,
          gross,
          taxRate,
          taxAmount,
          pool,
          JSON.stringify(allocationSnapshot),
          ctvTarget.id,
          ctvTarget.name || '',
          ctvRate,
          ctvBaseAmount,
          ctvBonusAmount,
          commissionAmount,
          actor.id,
        ],
      );
      return mapLedger(updated.rows[0]);
    });
  }

  async resolveException(
    actor: AppIdentity,
    ledgerId: string,
    data: CommissionExceptionResolutionRequest,
  ) {
    return this.db.transaction(async (client) => {
      const current = await client.query(
        `SELECT * FROM commission_ledger_entries WHERE id = $1 FOR UPDATE`,
        [ledgerId],
      );
      const row = current.rows[0];
      if (!row) throw new NotFoundException({ error: 'Không tìm thấy khoản hoa hồng.' });
      if (!row.review_required) {
        throw new ConflictException({ error: 'Khoản hoa hồng này không còn ở trạng thái cần xử lý ngoại lệ.' });
      }
      if (!isA04ReviewReason(row.review_reason)) {
        throw new ConflictException({
          error: 'Lý do rà soát hiện tại không thuộc luồng hủy hợp đồng/bỏ cọc A04.',
        });
      }
      if (row.payment_status === 'paid') {
        throw new ConflictException({
          error: 'Khoản hoa hồng đã thanh toán. Chính sách thu hồi/bù trừ sau paid chưa được chốt trong A04.',
        });
      }
      if (row.withdrawal_requested_at) {
        throw new ConflictException({
          error: 'Khoản hoa hồng đã có yêu cầu rút tiền nên không thể thay đổi số tiền trong A04.',
        });
      }
      if (!row.collaborator_id || row.status === 'blocked_no_collaborator') {
        throw new ConflictException({ error: 'Deal chưa có CTV nên chưa thể resolve hoa hồng.' });
      }

      type AllocationBasis = {
        targetId: string;
        targetName: string;
        targetKind: 'department' | 'position';
        percentage: number;
        isCtv: boolean;
      };

      let allocationSource: 'previous_snapshot' | 'current_config' = 'current_config';
      let basis: AllocationBasis[] = mapAllocationSnapshot(row.allocation_snapshot).map((item) => ({
        targetId: item.targetId,
        targetName: item.targetName,
        targetKind: item.targetKind,
        percentage: item.percentage,
        isCtv: item.isCtv,
      }));

      if (basis.length > 0) {
        allocationSource = 'previous_snapshot';
      } else {
        const targets = await client.query<{
          id: string;
          name: string;
          target_kind: 'department' | 'position';
          percentage: string | number;
          is_ctv: boolean;
        } & QueryResultRow>(
          `
            SELECT id, name, target_kind, percentage, is_ctv
            FROM commission_allocation_targets
            WHERE is_active = TRUE
            ORDER BY is_ctv DESC, target_kind, lower(name), id
            FOR SHARE
          `,
        );
        basis = targets.rows.map((target) => ({
          targetId: target.id,
          targetName: target.name || '',
          targetKind: target.target_kind,
          percentage: Number(target.percentage || 0),
          isCtv: Boolean(target.is_ctv),
        }));
      }

      const totalRate = basis.reduce((sum, target) => sum + target.percentage, 0);
      const ctvTargets = basis.filter((target) => target.isCtv);
      if (Math.abs(totalRate - 100) >= 0.0001 || ctvTargets.length !== 1) {
        throw new BadRequestException({
          error: allocationSource === 'previous_snapshot'
            ? 'Snapshot phân bổ cũ không còn hợp lệ để xử lý A04.'
            : 'Cơ cấu phân bổ hiện tại phải có tổng đúng 100% và đúng một vị trí CTV.',
        });
      }

      const gross = Number(data.grossCommissionX);
      const taxRate = 10;
      const taxAmount = gross * taxRate / 100;
      const pool = gross - taxAmount;
      const allocationSnapshot = basis.map((target) => ({
        ...target,
        amount: pool * target.percentage / 100,
      }));
      const ctvTarget = ctvTargets[0];
      const ctvRate = ctvTarget.percentage;
      const ctvBaseAmount = pool * ctvRate / 100;
      const ctvBonusAmount = Number(data.ctvBonus || 0);
      const commissionAmount = ctvBaseAmount + ctvBonusAmount;
      const resolvedAt = new Date().toISOString();
      const before = calculationFacts(row);
      const after = {
        grossCommissionX: gross,
        taxRateSnapshot: taxRate,
        taxAmount,
        allocationPool: pool,
        allocationSnapshot,
        ctvAllocationTargetId: ctvTarget.targetId,
        ctvAllocationTargetNameSnapshot: ctvTarget.targetName,
        ctvPercentageSnapshot: ctvRate,
        ctvBaseAmount,
        ctvBonusAmount,
        commissionAmount,
      };
      const sequence = Number(row.exception_resolution_count || 0) + 1;
      const remainingReviewReasons = String(row.review_reason || '')
        .split(';')
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) =>
          item !== 'deal_cancelled'
          && item !== 'contract_deposit_completion_reversed');
      const remainingReviewReason = remainingReviewReasons.join(';');
      const event = {
        sequence,
        sourceReviewReason: String(row.review_reason || ''),
        resolutionReason: data.reason,
        allocationSource,
        resolvedAt,
        resolvedByUserId: actor.id,
        before,
        after,
      };

      const updated = await client.query(
        `
          UPDATE commission_ledger_entries
          SET gross_commission_x = $2,
              tax_rate_snapshot = $3,
              tax_amount = $4,
              allocation_pool = $5,
              allocation_snapshot = $6::jsonb,
              ctv_allocation_target_id = $7,
              ctv_allocation_target_name_snapshot = $8,
              ctv_percentage_snapshot = $9,
              ctv_base_amount = $10,
              ctv_bonus_amount = $11,
              commission_amount = $12,
              calculated_at = $16,
              calculated_by_user_id = $13,
              exception_resolution_count = exception_resolution_count + 1,
              exception_resolution_reason = $14,
              exception_allocation_source = $15,
              exception_resolved_at = $16,
              exception_resolved_by_user_id = $13,
              exception_resolution_history = exception_resolution_history || $17::jsonb,
              admin_approved_at = NULL,
              admin_approved_by_user_id = NULL,
              accountant_approved_at = NULL,
              accountant_approved_by_user_id = NULL,
              payout_ready_at = NULL,
              payout_cycle_date = NULL,
              status = 'eligible_pending_amount',
              review_required = $18,
              review_reason = $19,
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [
          ledgerId,
          gross,
          taxRate,
          taxAmount,
          pool,
          JSON.stringify(allocationSnapshot),
          ctvTarget.targetId,
          ctvTarget.targetName,
          ctvRate,
          ctvBaseAmount,
          ctvBonusAmount,
          commissionAmount,
          actor.id,
          data.reason,
          allocationSource,
          resolvedAt,
          JSON.stringify([event]),
          remainingReviewReasons.length > 0,
          remainingReviewReason,
        ],
      );

      return {
        action: 'resolved' as const,
        ledger: mapLedger(updated.rows[0]),
        event,
      };
    });
  }

  async approvePayout(
    actor: AppIdentity,
    ledgerId: string,
    kind: 'admin' | 'accountant',
  ) {
    const role = String(actor.roleCode || '').toLowerCase();
    if (kind === 'admin' && role !== 'admin' && role !== 'superadmin') {
      throw new NotFoundException({ error: 'Không tìm thấy thao tác duyệt phù hợp.' });
    }
    if (kind === 'accountant' && role !== 'commission_accountant') {
      throw new NotFoundException({ error: 'Không tìm thấy thao tác duyệt phù hợp.' });
    }

    return this.db.transaction(async (client) => {
      const current = await client.query(
        `SELECT * FROM commission_ledger_entries WHERE id = $1 FOR UPDATE`,
        [ledgerId],
      );
      const row = current.rows[0];
      if (!row) throw new NotFoundException({ error: 'Không tìm thấy khoản hoa hồng.' });
      if (row.payment_status === 'paid') {
        return { action: 'unchanged' as const, ledger: mapLedger(row) };
      }
      if (row.status !== 'eligible_pending_amount') {
        throw new ConflictException({ error: 'Khoản hoa hồng chưa ở trạng thái đủ điều kiện chi trả.' });
      }
      if (row.review_required) {
        throw new ConflictException({ error: 'Khoản hoa hồng đang cần rà soát nên chưa thể duyệt thanh toán.' });
      }
      if (row.commission_amount === null || Number(row.commission_amount) <= 0) {
        throw new ConflictException({ error: 'Khoản hoa hồng chưa có số tiền dương để thanh toán.' });
      }

      const ownApproved = kind === 'admin'
        ? Boolean(row.admin_approved_at)
        : Boolean(row.accountant_approved_at);
      if (ownApproved) {
        return { action: 'unchanged' as const, ledger: mapLedger(row) };
      }

      const approvedAt = new Date();
      const otherApproved = kind === 'admin'
        ? Boolean(row.accountant_approved_at)
        : Boolean(row.admin_approved_at);
      const payoutReadyAt = otherApproved ? approvedAt : null;
      const payoutCycleDate = payoutReadyAt
        ? commissionPayoutCycleDateForReadyAt(payoutReadyAt)
        : null;

      const updated = kind === 'admin'
        ? await client.query(
            `
              UPDATE commission_ledger_entries
              SET admin_approved_at = $2,
                  admin_approved_by_user_id = $3,
                  payout_ready_at = COALESCE(payout_ready_at, $4),
                  payout_cycle_date = COALESCE(payout_cycle_date, $5::date),
                  updated_at = NOW()
              WHERE id = $1
              RETURNING *
            `,
            [ledgerId, approvedAt, actor.id, payoutReadyAt, payoutCycleDate],
          )
        : await client.query(
            `
              UPDATE commission_ledger_entries
              SET accountant_approved_at = $2,
                  accountant_approved_by_user_id = $3,
                  payout_ready_at = COALESCE(payout_ready_at, $4),
                  payout_cycle_date = COALESCE(payout_cycle_date, $5::date),
                  updated_at = NOW()
              WHERE id = $1
              RETURNING *
            `,
            [ledgerId, approvedAt, actor.id, payoutReadyAt, payoutCycleDate],
          );

      return {
        action: 'approved' as const,
        approvalKind: kind,
        ledger: mapLedger(updated.rows[0]),
      };
    });
  }

  async requestWithdrawal(actor: AppIdentity, ledgerId: string) {
    const scope = await this.collaboratorScope(actor);
    if (scope.mode !== 'self' || !scope.collaboratorId) {
      throw new NotFoundException({ error: 'Không tìm thấy hồ sơ CTV đang hoạt động của tài khoản này.' });
    }

    return this.db.transaction(async (client) => {
      const current = await client.query(
        `
          SELECT *
          FROM commission_ledger_entries
          WHERE id = $1
            AND collaborator_id = $2
          FOR UPDATE
        `,
        [ledgerId, scope.collaboratorId],
      );
      const row = current.rows[0];
      if (!row) {
        throw new NotFoundException({ error: 'Không tìm thấy khoản hoa hồng của CTV.' });
      }
      if (row.payment_status === 'paid') {
        throw new ConflictException({ error: 'Khoản hoa hồng này đã được đánh dấu thanh toán.' });
      }
      if (row.status !== 'eligible_pending_amount') {
        throw new ConflictException({ error: 'Khoản hoa hồng chưa ở trạng thái đủ điều kiện chi trả.' });
      }
      if (row.review_required) {
        throw new ConflictException({ error: 'Khoản hoa hồng đang cần rà soát nên chưa thể yêu cầu rút.' });
      }
      if (row.commission_amount === null || Number(row.commission_amount) <= 0) {
        throw new ConflictException({ error: 'Khoản hoa hồng chưa có số tiền được xác định.' });
      }
      if (row.withdrawal_requested_at) {
        return { action: 'unchanged' as const, ledger: mapLedger(row) };
      }

      const updated = await client.query(
        `
          UPDATE commission_ledger_entries
          SET withdrawal_requested_at = NOW(),
              withdrawal_requested_by_user_id = $2,
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [ledgerId, actor.id],
      );
      return { action: 'requested' as const, ledger: mapLedger(updated.rows[0]) };
    });
  }

  async markPaid(actor: AppIdentity, ledgerId: string) {
    return this.db.transaction(async (client) => {
      const current = await client.query(
        `
          SELECT *
          FROM commission_ledger_entries
          WHERE id = $1
          FOR UPDATE
        `,
        [ledgerId],
      );
      const row = current.rows[0];
      if (!row) {
        throw new NotFoundException({ error: 'Không tìm thấy khoản hoa hồng.' });
      }
      if (row.payment_status === 'paid') {
        return { action: 'unchanged' as const, ledger: mapLedger(row) };
      }
      if (row.status !== 'eligible_pending_amount') {
        throw new ConflictException({ error: 'Khoản hoa hồng chưa ở trạng thái đủ điều kiện chi trả.' });
      }
      if (row.review_required) {
        throw new ConflictException({ error: 'Khoản hoa hồng đang cần rà soát nên chưa thể đánh dấu thanh toán.' });
      }
      if (row.commission_amount === null || Number(row.commission_amount) <= 0) {
        throw new ConflictException({ error: 'Khoản hoa hồng chưa có số tiền dương để thanh toán.' });
      }
      if (!row.admin_approved_at || !row.accountant_approved_at) {
        throw new ConflictException({
          error: 'Khoản hoa hồng phải được cả Admin và Kế toán duyệt trước khi thanh toán.',
        });
      }
      const payoutCycleDate = dateOnly(row.payout_cycle_date);
      if (!row.payout_ready_at || !payoutCycleDate) {
        throw new ConflictException({ error: 'Khoản hoa hồng chưa được xếp vào đợt thanh toán.' });
      }
      const today = commissionVietnamDate(new Date());
      if (today < payoutCycleDate) {
        throw new ConflictException({
          error: `Khoản hoa hồng thuộc đợt ${payoutCycleDate}; chưa đến ngày xác nhận thanh toán.`,
        });
      }

      const updated = await client.query(
        `
          UPDATE commission_ledger_entries
          SET payment_status = 'paid',
              paid_at = COALESCE(paid_at, NOW()),
              paid_by_user_id = COALESCE(paid_by_user_id, $2),
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [ledgerId, actor.id],
      );
      return { action: 'paid' as const, ledger: mapLedger(updated.rows[0]) };
    });
  }

  private complete(row: DealSnapshotRow) {
    const required = row.deposit_required_amount === null
      ? null
      : Number(row.deposit_required_amount);
    const paid = Number(row.deposit_paid_amount || 0);
    return Boolean(row.contract_signed_at) && required !== null && required > 0 && paid >= required;
  }

  async ensureForEligibleDeal(client: PoolClient, dealId: string) {
    const current = await client.query<DealSnapshotRow>(
      `
        SELECT
          d.id, d.customer_id, d.collaborator_id, d.source_type, d.source_channel,
          d.source_recorded_at, d.room_unit_id, d.final_price,
          d.contract_signed_at, d.deposit_required_amount, d.deposit_paid_amount,
          d.lifecycle_status,
          COALESCE(c.name, '') AS collaborator_name,
          c.collaborator_type_id,
          COALESCE(ct.name, '') AS collaborator_type_name,
          COALESCE(u.code, '') AS room_unit_code
        FROM deals d
        LEFT JOIN collaborators c ON c.id = d.collaborator_id
        LEFT JOIN collaborator_types ct ON ct.id = c.collaborator_type_id
        JOIN room_units u ON u.id = d.room_unit_id
        WHERE d.id = $1
        FOR UPDATE OF d
      `,
      [dealId],
    );
    const deal = current.rows[0];
    if (!deal || deal.lifecycle_status !== 'active' || !this.complete(deal)) {
      return { action: 'not-eligible' as const, ledger: null };
    }

    const status: CommissionLedgerStatus = deal.collaborator_id
      ? 'eligible_pending_amount'
      : 'blocked_no_collaborator';

    const existing = await client.query<{ id: string } & QueryResultRow>(
      'SELECT id FROM commission_ledger_entries WHERE deal_id = $1 FOR UPDATE',
      [dealId],
    );
    const id = existing.rows[0]?.id || `CLED-${crypto.randomUUID()}`;

    const result = await client.query(
      `
        INSERT INTO commission_ledger_entries (
          id, deal_id, customer_id,
          collaborator_id, collaborator_name_snapshot,
          collaborator_type_id, collaborator_type_name_snapshot,
          room_unit_id, room_unit_code_snapshot, final_price_snapshot,
          source_type_snapshot, source_channel_snapshot, source_recorded_at_snapshot,
          policy_id, policy_percentage_snapshot,
          policy_amount_6_months_snapshot, policy_amount_12_months_snapshot,
          selected_contract_months, commission_amount,
          status, review_required, review_reason, eligible_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
          NULL,NULL,NULL,NULL,NULL,NULL,$14,FALSE,'',NOW()
        )
        ON CONFLICT (deal_id)
        DO UPDATE SET
          collaborator_id = CASE
            WHEN commission_ledger_entries.commission_amount IS NULL
              THEN EXCLUDED.collaborator_id
            ELSE commission_ledger_entries.collaborator_id
          END,
          collaborator_name_snapshot = CASE
            WHEN commission_ledger_entries.commission_amount IS NULL
              THEN EXCLUDED.collaborator_name_snapshot
            ELSE commission_ledger_entries.collaborator_name_snapshot
          END,
          collaborator_type_id = CASE
            WHEN commission_ledger_entries.commission_amount IS NULL
              THEN EXCLUDED.collaborator_type_id
            ELSE commission_ledger_entries.collaborator_type_id
          END,
          collaborator_type_name_snapshot = CASE
            WHEN commission_ledger_entries.commission_amount IS NULL
              THEN EXCLUDED.collaborator_type_name_snapshot
            ELSE commission_ledger_entries.collaborator_type_name_snapshot
          END,
          room_unit_id = CASE
            WHEN commission_ledger_entries.commission_amount IS NULL
              THEN EXCLUDED.room_unit_id
            ELSE commission_ledger_entries.room_unit_id
          END,
          room_unit_code_snapshot = CASE
            WHEN commission_ledger_entries.commission_amount IS NULL
              THEN EXCLUDED.room_unit_code_snapshot
            ELSE commission_ledger_entries.room_unit_code_snapshot
          END,
          final_price_snapshot = CASE
            WHEN commission_ledger_entries.commission_amount IS NULL
              THEN EXCLUDED.final_price_snapshot
            ELSE commission_ledger_entries.final_price_snapshot
          END,
          source_type_snapshot = CASE
            WHEN commission_ledger_entries.commission_amount IS NULL
              THEN EXCLUDED.source_type_snapshot
            ELSE commission_ledger_entries.source_type_snapshot
          END,
          source_channel_snapshot = CASE
            WHEN commission_ledger_entries.commission_amount IS NULL
              THEN EXCLUDED.source_channel_snapshot
            ELSE commission_ledger_entries.source_channel_snapshot
          END,
          source_recorded_at_snapshot = CASE
            WHEN commission_ledger_entries.commission_amount IS NULL
              THEN EXCLUDED.source_recorded_at_snapshot
            ELSE commission_ledger_entries.source_recorded_at_snapshot
          END,
          policy_id = CASE WHEN commission_ledger_entries.commission_amount IS NULL THEN NULL ELSE commission_ledger_entries.policy_id END,
          policy_percentage_snapshot = CASE WHEN commission_ledger_entries.commission_amount IS NULL THEN NULL ELSE commission_ledger_entries.policy_percentage_snapshot END,
          policy_amount_6_months_snapshot = CASE WHEN commission_ledger_entries.commission_amount IS NULL THEN NULL ELSE commission_ledger_entries.policy_amount_6_months_snapshot END,
          policy_amount_12_months_snapshot = CASE WHEN commission_ledger_entries.commission_amount IS NULL THEN NULL ELSE commission_ledger_entries.policy_amount_12_months_snapshot END,
          selected_contract_months = CASE WHEN commission_ledger_entries.commission_amount IS NULL THEN NULL ELSE commission_ledger_entries.selected_contract_months END,
          status = CASE
            WHEN commission_ledger_entries.commission_amount IS NULL THEN EXCLUDED.status
            ELSE commission_ledger_entries.status
          END,
          updated_at = NOW()
        RETURNING *
      `,
      [
        id, deal.id, deal.customer_id,
        deal.collaborator_id, deal.collaborator_name || '',
        deal.collaborator_type_id, deal.collaborator_type_name || '',
        deal.room_unit_id, deal.room_unit_code || '', Number(deal.final_price || 0),
        deal.source_type || '', deal.source_channel || '', deal.source_recorded_at,
        status,
      ],
    );

    return {
      action: existing.rows[0] ? 'reconciled' as const : 'created' as const,
      ledger: mapLedger(result.rows[0]),
    };
  }

  async flagReview(client: PoolClient, dealId: string, reason: string) {
    const result = await client.query(
      `
        UPDATE commission_ledger_entries
        SET review_required = TRUE,
            review_reason = CASE
              WHEN review_reason = '' THEN $2
              WHEN position($2 in review_reason) > 0 THEN review_reason
              ELSE review_reason || ';' || $2
            END,
            admin_approved_at = CASE WHEN payment_status = 'paid' THEN admin_approved_at ELSE NULL END,
            admin_approved_by_user_id = CASE WHEN payment_status = 'paid' THEN admin_approved_by_user_id ELSE NULL END,
            accountant_approved_at = CASE WHEN payment_status = 'paid' THEN accountant_approved_at ELSE NULL END,
            accountant_approved_by_user_id = CASE WHEN payment_status = 'paid' THEN accountant_approved_by_user_id ELSE NULL END,
            payout_ready_at = CASE WHEN payment_status = 'paid' THEN payout_ready_at ELSE NULL END,
            payout_cycle_date = CASE WHEN payment_status = 'paid' THEN payout_cycle_date ELSE NULL END,
            updated_at = NOW()
        WHERE deal_id = $1
        RETURNING *
      `,
      [dealId, reason],
    );
    return result.rows[0] ? mapLedger(result.rows[0]) : null;
  }
}
