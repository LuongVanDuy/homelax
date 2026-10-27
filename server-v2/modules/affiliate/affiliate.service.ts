import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  affiliateTokenSchema,
  type AffiliateReferral,
  type CtvMyCustomersQuery,
} from '@tinyhouse/contracts';
import type { QueryResultRow } from 'pg';
import type { AppIdentity } from '../../common/auth/auth.types.js';
import { escapedLike, pageOffset, pageResult } from '../../common/list/list-utils.js';
import { PostgresService } from '../../database/postgres.service.js';

type ReferralRow = QueryResultRow & {
  id: string;
  name: string;
  phone: string;
  affiliate_token: string;
};

function iso(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
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
  return text.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || null;
}

@Injectable()
export class AffiliateService {
  constructor(private readonly db: PostgresService) {}

  private async activeReferral(whereSql: string, value: string) {
    const result = await this.db.query<ReferralRow>(
      `
        SELECT c.id, c.name, c.phone, c.affiliate_token
        FROM collaborators c
        JOIN users u ON u.id = c.user_id
        WHERE ${whereSql}
          AND c.archived_at IS NULL
          AND lower(COALESCE(u.role_code, '')) = 'ctv_sale'
          AND lower(btrim(COALESCE(u.status, ''))) IN ('hoạt động', 'active', 'approved', 'enabled')
        LIMIT 1
      `,
      [value],
    );
    return result.rows[0] || null;
  }

  private mapReferral(row: ReferralRow): AffiliateReferral {
    return {
      collaboratorId: row.id,
      collaboratorName: row.name || '',
      phone: row.phone || '',
      affiliateToken: row.affiliate_token,
    };
  }

  private async requireMine(identity: AppIdentity) {
    if (String(identity.roleCode || '').toLowerCase() !== 'ctv_sale') {
      throw new ForbiddenException({
        error: 'Chỉ tài khoản CTV đang hoạt động mới truy cập được dữ liệu này.',
      });
    }
    const row = await this.activeReferral('c.user_id = $1', identity.id);
    if (!row) {
      throw new ForbiddenException({
        error: 'Không tìm thấy hồ sơ CTV đang hoạt động của tài khoản này.',
      });
    }
    return row;
  }

  async mine(identity: AppIdentity) {
    return this.mapReferral(await this.requireMine(identity));
  }

  async myCustomers(identity: AppIdentity, query: CtvMyCustomersQuery) {
    const collaborator = await this.requireMine(identity);
    const collaboratorId = collaborator.id;
    const pattern = escapedLike(query.search);
    const order = query.order === 'asc' ? 'ASC' : 'DESC';
    const sortColumn = {
      sourceRecordedAt: 'COALESCE(source_recorded_at, created_at)',
      customerName: 'lower(customer_name)',
      latestActivityAt: 'latest_activity_at',
    }[query.sort] || 'COALESCE(source_recorded_at, created_at)';

    const statsResult = await this.db.query<{
      customer_count: number;
      booking_count: number;
      deposited_customer_count: number;
      closed_customer_count: number;
      commission_pending_approval_amount: string | number;
      commission_approved_unpaid_amount: string | number;
      commission_paid_amount: string | number;
      commission_review_amount: string | number;
      commission_unresolved_count: number;
    }>(
      `
        SELECT
          (
            SELECT COUNT(*)::int
            FROM customers c
            WHERE c.referred_by_collaborator_id = $1
              AND c.archived_at IS NULL
          ) AS customer_count,
          (
            SELECT COUNT(*)::int
            FROM bookings b
            WHERE b.collaborator_id = $1
          ) AS booking_count,
          (
            SELECT COUNT(DISTINCT d.customer_id)::int
            FROM deals d
            WHERE d.collaborator_id = $1
              AND d.lifecycle_status = 'active'
              AND d.deposit_paid_amount > 0
          ) AS deposited_customer_count,
          (
            SELECT COUNT(DISTINCT d.customer_id)::int
            FROM deals d
            WHERE d.collaborator_id = $1
              AND d.lifecycle_status = 'active'
              AND d.contract_signed_at IS NOT NULL
              AND d.deposit_required_amount IS NOT NULL
              AND d.deposit_required_amount > 0
              AND d.deposit_paid_amount >= d.deposit_required_amount
          ) AS closed_customer_count,
          COALESCE((
            SELECT SUM(COALESCE(l.commission_amount, 0))
            FROM commission_ledger_entries l
            WHERE l.collaborator_id = $1
              AND l.payment_status = 'unpaid'
              AND l.review_required = FALSE
              AND l.commission_amount > 0
              AND (l.admin_approved_at IS NULL OR l.accountant_approved_at IS NULL)
          ), 0) AS commission_pending_approval_amount,
          COALESCE((
            SELECT SUM(COALESCE(l.commission_amount, 0))
            FROM commission_ledger_entries l
            WHERE l.collaborator_id = $1
              AND l.payment_status = 'unpaid'
              AND l.review_required = FALSE
              AND l.commission_amount > 0
              AND l.admin_approved_at IS NOT NULL
              AND l.accountant_approved_at IS NOT NULL
          ), 0) AS commission_approved_unpaid_amount,
          COALESCE((
            SELECT SUM(COALESCE(l.commission_amount, 0))
            FROM commission_ledger_entries l
            WHERE l.collaborator_id = $1
              AND l.payment_status = 'paid'
              AND l.commission_amount > 0
          ), 0) AS commission_paid_amount,
          COALESCE((
            SELECT SUM(COALESCE(l.commission_amount, 0))
            FROM commission_ledger_entries l
            WHERE l.collaborator_id = $1
              AND l.payment_status = 'unpaid'
              AND l.review_required = TRUE
              AND l.commission_amount > 0
          ), 0) AS commission_review_amount,
          (
            SELECT COUNT(*)::int
            FROM commission_ledger_entries l
            WHERE l.collaborator_id = $1
              AND l.commission_amount IS NULL
          ) AS commission_unresolved_count
      `,
      [collaboratorId],
    );
    const statsRow = statsResult.rows[0];

    const rows = await this.db.query<Record<string, any>>(
      `
        WITH customer_journey AS (
          SELECT
            c.id AS customer_id,
            COALESCE(c.name, '') AS customer_name,
            COALESCE(c.phone, '') AS phone,
            c.source_recorded_at,
            c.created_at,
            GREATEST(
              c.updated_at,
              COALESCE(lb.latest_booking_activity_at, c.updated_at),
              COALESCE(ld.latest_deal_activity_at, c.updated_at),
              COALESCE(lc.latest_commission_activity_at, c.updated_at)
            ) AS latest_activity_at,
            CASE
              WHEN ld.id IS NOT NULL AND ld.lifecycle_status = 'cancelled' THEN 'cancelled'
              WHEN ld.id IS NOT NULL
                AND ld.lifecycle_status = 'active'
                AND ld.contract_signed_at IS NOT NULL
                AND ld.deposit_required_amount IS NOT NULL
                AND ld.deposit_required_amount > 0
                AND ld.deposit_paid_amount >= ld.deposit_required_amount
                THEN 'closed'
              WHEN ld.id IS NOT NULL
                AND ld.lifecycle_status = 'active'
                AND ld.deposit_paid_amount > 0
                THEN 'deposited'
              WHEN ld.id IS NOT NULL THEN 'deal'
              WHEN lb.status = 'Đã huỷ' THEN 'cancelled'
              WHEN lb.id IS NOT NULL THEN 'booking'
              ELSE 'introduced'
            END AS stage,

            lb.id AS booking_id,
            lb.status AS booking_status,
            lb.appointment_at AS booking_appointment_at,
            lb.building_code AS booking_building_code,
            lb.building_name AS booking_building_name,
            lb.room_unit_id AS booking_room_unit_id,
            lb.room_unit_code AS booking_room_unit_code,
            lb.room_type_name AS booking_room_type_name,

            ld.id AS deal_id,
            ld.lifecycle_status AS deal_lifecycle_status,
            ld.building_code AS deal_building_code,
            ld.building_name AS deal_building_name,
            ld.room_unit_id AS deal_room_unit_id,
            ld.room_unit_code AS deal_room_unit_code,
            ld.room_type_name AS deal_room_type_name,
            ld.final_price AS deal_final_price,
            ld.contract_months AS deal_contract_months,
            ld.contract_signed_at AS deal_contract_signed_at,
            ld.deposit_required_amount AS deal_deposit_required_amount,
            ld.deposit_paid_amount AS deal_deposit_paid_amount,
            ld.created_at AS deal_created_at,

            COALESCE(lc.total_amount, 0) AS commission_total_amount,
            COALESCE(lc.pending_approval_amount, 0) AS commission_pending_approval_amount,
            COALESCE(lc.approved_unpaid_amount, 0) AS commission_approved_unpaid_amount,
            COALESCE(lc.paid_amount, 0) AS commission_paid_amount,
            COALESCE(lc.review_amount, 0) AS commission_review_amount,
            COALESCE(lc.unresolved_count, 0) AS commission_unresolved_count,
            lc.latest_payout_cycle_date
          FROM customers c
          LEFT JOIN LATERAL (
            SELECT
              b.id,
              b.status,
              b.appointment_at,
              b.building_code,
              COALESCE(building.name, '') AS building_name,
              b.room_unit_id,
              COALESCE(unit.code, b.room_number, '') AS room_unit_code,
              COALESCE(room.type, '') AS room_type_name,
              GREATEST(b.created_at, b.updated_at) AS latest_booking_activity_at
            FROM bookings b
            LEFT JOIN buildings building ON building.id = b.building_id
            LEFT JOIN room_units unit ON unit.id = b.room_unit_id
            LEFT JOIN rooms room ON room.id = COALESCE(unit.room_type_id, b.room_type_id)
            WHERE b.customer_id = c.id
              AND b.collaborator_id = $1
            ORDER BY COALESCE(b.appointment_at, b.created_at) DESC, b.created_at DESC, b.id DESC
            LIMIT 1
          ) lb ON TRUE
          LEFT JOIN LATERAL (
            SELECT
              d.id,
              d.lifecycle_status,
              building.code AS building_code,
              building.name AS building_name,
              d.room_unit_id,
              unit.code AS room_unit_code,
              room.type AS room_type_name,
              d.final_price,
              d.contract_months,
              d.contract_signed_at,
              d.deposit_required_amount,
              d.deposit_paid_amount,
              d.created_at,
              GREATEST(d.created_at, d.updated_at) AS latest_deal_activity_at
            FROM deals d
            JOIN room_units unit ON unit.id = d.room_unit_id
            JOIN buildings building ON building.id = unit.building_id
            JOIN rooms room ON room.id = unit.room_type_id
            WHERE d.customer_id = c.id
              AND d.collaborator_id = $1
            ORDER BY d.created_at DESC, d.id DESC
            LIMIT 1
          ) ld ON TRUE
          LEFT JOIN LATERAL (
            SELECT
              COALESCE(SUM(COALESCE(l.commission_amount, 0)), 0) AS total_amount,
              COALESCE(SUM(COALESCE(l.commission_amount, 0)) FILTER (
                WHERE l.payment_status = 'unpaid'
                  AND l.review_required = FALSE
                  AND l.commission_amount > 0
                  AND (l.admin_approved_at IS NULL OR l.accountant_approved_at IS NULL)
              ), 0) AS pending_approval_amount,
              COALESCE(SUM(COALESCE(l.commission_amount, 0)) FILTER (
                WHERE l.payment_status = 'unpaid'
                  AND l.review_required = FALSE
                  AND l.commission_amount > 0
                  AND l.admin_approved_at IS NOT NULL
                  AND l.accountant_approved_at IS NOT NULL
              ), 0) AS approved_unpaid_amount,
              COALESCE(SUM(COALESCE(l.commission_amount, 0)) FILTER (
                WHERE l.payment_status = 'paid' AND l.commission_amount > 0
              ), 0) AS paid_amount,
              COALESCE(SUM(COALESCE(l.commission_amount, 0)) FILTER (
                WHERE l.payment_status = 'unpaid'
                  AND l.review_required = TRUE
                  AND l.commission_amount > 0
              ), 0) AS review_amount,
              COUNT(*) FILTER (WHERE l.commission_amount IS NULL)::int AS unresolved_count,
              MAX(l.payout_cycle_date) FILTER (
                WHERE l.payment_status = 'unpaid'
                  AND l.payout_cycle_date IS NOT NULL
              ) AS latest_payout_cycle_date,
              MAX(l.updated_at) AS latest_commission_activity_at
            FROM commission_ledger_entries l
            WHERE l.customer_id = c.id
              AND l.collaborator_id = $1
          ) lc ON TRUE
          WHERE c.referred_by_collaborator_id = $1
            AND c.archived_at IS NULL
        )
        SELECT *, COUNT(*) OVER()::int AS total_count
        FROM customer_journey
        WHERE ($2 = '' OR stage = $2)
          AND (
            $3 = ''
            OR customer_name ILIKE $4 ESCAPE '\\'
            OR phone ILIKE $4 ESCAPE '\\'
            OR COALESCE(booking_building_code, '') ILIKE $4 ESCAPE '\\'
            OR COALESCE(booking_room_unit_code, '') ILIKE $4 ESCAPE '\\'
            OR COALESCE(deal_building_code, '') ILIKE $4 ESCAPE '\\'
            OR COALESCE(deal_room_unit_code, '') ILIKE $4 ESCAPE '\\'
          )
        ORDER BY ${sortColumn} ${order}, customer_id ASC
        LIMIT $5 OFFSET $6
      `,
      [
        collaboratorId,
        query.stage,
        query.search,
        pattern,
        query.pageSize,
        pageOffset(query.page, query.pageSize),
      ],
    );

    const items = rows.rows.map((row) => {
      const requiredDeposit = row.deal_deposit_required_amount === null
        || row.deal_deposit_required_amount === undefined
        ? null
        : Number(row.deal_deposit_required_amount);
      const paidDeposit = Number(row.deal_deposit_paid_amount || 0);
      return {
        customerId: String(row.customer_id),
        customerName: String(row.customer_name || ''),
        phone: String(row.phone || ''),
        sourceRecordedAt: iso(row.source_recorded_at),
        createdAt: iso(row.created_at) || '',
        latestActivityAt: iso(row.latest_activity_at) || '',
        stage: row.stage,
        latestBooking: row.booking_id ? {
          id: String(row.booking_id),
          status: String(row.booking_status || ''),
          appointmentAt: iso(row.booking_appointment_at),
          buildingCode: String(row.booking_building_code || ''),
          buildingName: String(row.booking_building_name || ''),
          roomUnitId: row.booking_room_unit_id ? String(row.booking_room_unit_id) : null,
          roomUnitCode: String(row.booking_room_unit_code || ''),
          roomTypeName: String(row.booking_room_type_name || ''),
        } : null,
        latestDeal: row.deal_id ? {
          id: String(row.deal_id),
          lifecycleStatus: row.deal_lifecycle_status === 'cancelled' ? 'cancelled' as const : 'active' as const,
          buildingCode: String(row.deal_building_code || ''),
          buildingName: String(row.deal_building_name || ''),
          roomUnitId: String(row.deal_room_unit_id || ''),
          roomUnitCode: String(row.deal_room_unit_code || ''),
          roomTypeName: String(row.deal_room_type_name || ''),
          finalPrice: Number(row.deal_final_price || 0),
          contractMonths: row.deal_contract_months === null || row.deal_contract_months === undefined
            ? null
            : Number(row.deal_contract_months),
          contractSigned: Boolean(row.deal_contract_signed_at),
          depositRequiredAmount: requiredDeposit,
          depositPaidAmount: paidDeposit,
          contractDepositComplete: Boolean(
            row.deal_contract_signed_at
            && requiredDeposit !== null
            && requiredDeposit > 0
            && paidDeposit >= requiredDeposit,
          ),
          createdAt: iso(row.deal_created_at),
        } : null,
        commission: {
          totalAmount: Number(row.commission_total_amount || 0),
          pendingApprovalAmount: Number(row.commission_pending_approval_amount || 0),
          approvedUnpaidAmount: Number(row.commission_approved_unpaid_amount || 0),
          paidAmount: Number(row.commission_paid_amount || 0),
          reviewAmount: Number(row.commission_review_amount || 0),
          unresolvedCount: Number(row.commission_unresolved_count || 0),
          latestPayoutCycleDate: dateOnly(row.latest_payout_cycle_date),
        },
      };
    });
    const total = Number(rows.rows[0]?.total_count || 0);
    const paged = pageResult(items, query.page, query.pageSize, total);

    return {
      referral: this.mapReferral(collaborator),
      stats: {
        customerCount: Number(statsRow?.customer_count || 0),
        bookingCount: Number(statsRow?.booking_count || 0),
        depositedCustomerCount: Number(statsRow?.deposited_customer_count || 0),
        closedCustomerCount: Number(statsRow?.closed_customer_count || 0),
        commissionPendingApprovalAmount: Number(statsRow?.commission_pending_approval_amount || 0),
        commissionApprovedUnpaidAmount: Number(statsRow?.commission_approved_unpaid_amount || 0),
        commissionPaidAmount: Number(statsRow?.commission_paid_amount || 0),
        commissionReviewAmount: Number(statsRow?.commission_review_amount || 0),
        commissionUnresolvedCount: Number(statsRow?.commission_unresolved_count || 0),
      },
      ...paged,
    };
  }

  async resolveToken(token: string) {
    const parsed = affiliateTokenSchema.safeParse(token);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'Liên kết giới thiệu không hợp lệ.',
      });
    }

    const row = await this.activeReferral('c.affiliate_token = $1', parsed.data);
    if (!row) {
      throw new BadRequestException({
        error: 'Liên kết giới thiệu không hợp lệ hoặc CTV không còn hoạt động.',
      });
    }
    return this.mapReferral(row);
  }
}
