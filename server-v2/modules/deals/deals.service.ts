import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import crypto from 'crypto';
import type { PoolClient, QueryResultRow } from 'pg';
import {
  DEAL_FINANCE_BOUNDARY,
  type CancelDealRequest,
  type ChangeDealRoomUnitRequest,
  type CreateDealDirectRequest,
  type CreateDealFromBookingRequest,
  type DealAssignmentRequest,
  type DealListQuery,
  type DealNoteRequest,
  type UpdateDealCommercialTermsRequest,
  type UpdateDealContractDepositRequest,
  type UpdateDealRentalScheduleRequest,
} from '@tinyhouse/contracts';
import type { AppIdentity } from '../../common/auth/auth.types.js';
import { escapedLike, pageOffset, pageResult } from '../../common/list/list-utils.js';
import { PostgresService } from '../../database/postgres.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CommissionLedgerService } from '../commission-ledger/commission-ledger.service.js';

const DEAL_SELECT = `
  SELECT
    d.*,
    booking.status AS booking_status,
    customer.name AS customer_name,
    customer.phone AS customer_phone,
    customer.user_id AS customer_user_id,
    COALESCE(collaborator.name, '') AS collaborator_name,
    COALESCE(deal_assignee.name, '') AS assigned_user_name,
    COALESCE(deal_assignee.email, '') AS assigned_user_email,
    unit.code AS room_unit_code,
    unit.room_type_id,
    room.type AS room_type_name,
    building.id AS building_id,
    building.code AS building_code,
    building.name AS building_name
  FROM deals d
  JOIN customers customer ON customer.id = d.customer_id
  LEFT JOIN bookings booking ON booking.id = d.booking_id
  LEFT JOIN collaborators collaborator ON collaborator.id = d.collaborator_id
  LEFT JOIN users deal_assignee ON deal_assignee.id = d.assigned_user_id
  JOIN room_units unit ON unit.id = d.room_unit_id
  JOIN rooms room ON room.id = unit.room_type_id
  JOIN buildings building ON building.id = unit.building_id
`;

function iso(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function dateOnly(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function mapDeal(row: Record<string, any>) {
  const contractSignedAt = iso(row.contract_signed_at);
  const depositRequiredAmount = row.deposit_required_amount === null || row.deposit_required_amount === undefined
    ? null
    : Number(row.deposit_required_amount);
  const depositPaidAmount = Number(row.deposit_paid_amount || 0);
  const depositFullyPaid = depositRequiredAmount !== null && depositRequiredAmount > 0 && depositPaidAmount >= depositRequiredAmount;
  return {
    id: String(row.id || ''),
    bookingId: row.booking_id ? String(row.booking_id) : null,
    bookingStatus: row.booking_status ? String(row.booking_status) : null,
    customerId: String(row.customer_id || ''),
    customerUserId: row.customer_user_id ? String(row.customer_user_id) : null,
    customerName: String(row.customer_name || ''),
    customerPhone: String(row.customer_phone || ''),
    collaboratorId: row.collaborator_id ? String(row.collaborator_id) : null,
    collaboratorName: String(row.collaborator_name || ''),
    sourceType: String(row.source_type || ''),
    sourceChannel: String(row.source_channel || ''),
    sourceRecordedAt: iso(row.source_recorded_at),
    assignedUserId: row.assigned_user_id ? String(row.assigned_user_id) : null,
    assignedUserName: String(row.assigned_user_name || ''),
    assignedUserEmail: String(row.assigned_user_email || ''),
    notes: String(row.notes || ''),
    activity: (Array.isArray(row.activity_log) ? row.activity_log : []).map((item: any) => ({
      id: String(item?.id || ''),
      type: String(item?.type || 'update'),
      title: String(item?.title || 'Cập nhật giao dịch'),
      detail: String(item?.detail || ''),
      actorId: item?.actorId ? String(item.actorId) : null,
      actorName: String(item?.actorName || ''),
      createdAt: String(item?.createdAt || ''),
    })).filter((item: { id: string; createdAt: string }) => item.id && item.createdAt),
    roomUnitId: String(row.room_unit_id || ''),
    roomUnitCode: String(row.room_unit_code || ''),
    roomTypeId: String(row.room_type_id || ''),
    roomTypeName: String(row.room_type_name || ''),
    buildingId: String(row.building_id || ''),
    buildingCode: String(row.building_code || ''),
    buildingName: String(row.building_name || ''),
    finalPrice: Number(row.final_price || 0),
    contractMonths:
      row.contract_months === null || row.contract_months === undefined
        ? null
        : Number(row.contract_months),
    contractSignedAt,
    contractSigned: Boolean(contractSignedAt),
    depositRequiredAmount,
    depositPaidAmount,
    depositFullyPaid,
    contractDepositComplete: Boolean(contractSignedAt) && depositFullyPaid,
    rentalStartDate: dateOnly(row.rental_start_date),
    rentalEndDate: dateOnly(row.rental_end_date),
    rentalScheduleComplete: Boolean(row.rental_start_date && row.rental_end_date),
    lifecycleStatus: row.lifecycle_status === 'cancelled' ? 'cancelled' : 'active',
    cancelledAt: iso(row.cancelled_at),
    cancellationReason: String(row.cancellation_reason || ''),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

@Injectable()
export class DealsService {
  constructor(
    private readonly db: PostgresService,
    private readonly audit: AuditService,
    private readonly commissionLedger: CommissionLedgerService,
  ) {}

  private accessMode(identity: AppIdentity) {
    if (identity.dealScope === 'all') return 'all' as const;
    if (identity.dealScope === 'assigned') return 'assigned' as const;
    return 'none' as const;
  }

  private activityEvent(
    actor: AppIdentity,
    type: string,
    title: string,
    detail = '',
  ) {
    return {
      id: `DA-${crypto.randomUUID()}`,
      type,
      title,
      detail,
      actorId: actor.id || null,
      actorName: actor.name || actor.email || 'Hệ thống',
      createdAt: new Date().toISOString(),
    };
  }

  private async appendActivity(
    client: PoolClient,
    id: string,
    event: ReturnType<DealsService['activityEvent']>,
  ) {
    await client.query(
      `UPDATE deals
       SET activity_log = COALESCE(activity_log, '[]'::jsonb) || $2::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [id, JSON.stringify([event])],
    );
  }

  private async resolveAssignee(client: PoolClient, assignedUserId: string | null) {
    if (!assignedUserId) return null;
    const result = await client.query<{
      id: string;
      name: string;
      email: string;
      role_code: string;
      role_name: string;
      deal_scope: 'all' | 'assigned';
    } & QueryResultRow>(
      `SELECT u.id, u.name, u.email, u.role_code,
              COALESCE(r.name, u.role_name, u.role_code) AS role_name,
              r.deal_scope
       FROM users u
       JOIN roles r ON lower(r.code) = lower(u.role_code)
       WHERE u.id = $1
         AND lower(btrim(u.status)) IN ('hoạt động', 'active', 'approved', 'enabled')
         AND r.deal_scope IN ('all', 'assigned')
         AND (
           COALESCE(r.allowed_screens, '[]'::jsonb) ? 'deals'
           OR COALESCE(r.allowed_screens, '[]'::jsonb) ? '*'
         )
       LIMIT 1`,
      [assignedUserId],
    );
    if (!result.rows[0]) {
      throw new BadRequestException({
        error: 'Người phụ trách phải là tài khoản đang hoạt động có quyền Giao dịch thuê.',
      });
    }
    return result.rows[0];
  }

  financeBoundary(identity: AppIdentity) {
    if (this.accessMode(identity) === 'none') {
      throw new ForbiddenException({
        error: 'Bạn không có quyền xem ranh giới tài chính của giao dịch thuê.',
      });
    }
    return DEAL_FINANCE_BOUNDARY;
  }

  private contractDepositComplete(
    contractSignedAt: unknown,
    depositRequiredAmount: unknown,
    depositPaidAmount: unknown,
  ) {
    const required = depositRequiredAmount === null || depositRequiredAmount === undefined
      ? null
      : Number(depositRequiredAmount);
    const paid = Number(depositPaidAmount || 0);
    return Boolean(contractSignedAt) && required !== null && required > 0 && paid >= required;
  }

  private async activeDealForRoomUnit(
    client: PoolClient,
    roomUnitId: string,
    excludeDealId = '',
  ) {
    const result = await client.query<{ id: string } & QueryResultRow>(
      `SELECT id
       FROM deals
       WHERE room_unit_id = $1
         AND lifecycle_status = 'active'
         AND ($2 = '' OR id <> $2)
       LIMIT 1`,
      [roomUnitId, excludeDealId],
    );
    return result.rows[0]?.id || null;
  }

  private async setOccupiedForDeal(
    client: PoolClient,
    roomUnitId: string,
    rentalEndDate: unknown,
  ) {
    const unitResult = await client.query<{
      id: string;
      status: string;
      available_from: Date | string | null;
    } & QueryResultRow>(
      `SELECT id, status, available_from
       FROM room_units
       WHERE id = $1
       FOR UPDATE`,
      [roomUnitId],
    );
    const unit = unitResult.rows[0];
    if (!unit) {
      throw new ConflictException({ error: 'Room Unit của Deal không còn tồn tại.' });
    }
    if (unit.status === 'maintenance' || unit.status === 'archived') {
      return {
        changed: false,
        action: 'protected-status',
        statusBefore: unit.status,
        statusAfter: unit.status,
        availableFromBefore: dateOnly(unit.available_from),
        availableFromAfter: dateOnly(unit.available_from),
      };
    }
    const nextAvailableFrom = dateOnly(rentalEndDate);
    await client.query(
      `UPDATE room_units
       SET status = 'occupied', available_from = $2::date, updated_at = NOW()
       WHERE id = $1`,
      [roomUnitId, nextAvailableFrom],
    );
    return {
      changed: unit.status !== 'occupied' || dateOnly(unit.available_from) !== nextAvailableFrom,
      action: 'occupy',
      statusBefore: unit.status,
      statusAfter: 'occupied',
      availableFromBefore: dateOnly(unit.available_from),
      availableFromAfter: nextAvailableFrom,
    };
  }

  private async releaseRoomUnit(
    client: PoolClient,
    roomUnitId: string,
  ) {
    const unitResult = await client.query<{
      id: string;
      status: string;
      available_from: Date | string | null;
    } & QueryResultRow>(
      `SELECT id, status, available_from
       FROM room_units
       WHERE id = $1
       FOR UPDATE`,
      [roomUnitId],
    );
    const unit = unitResult.rows[0];
    if (!unit) {
      throw new ConflictException({ error: 'Room Unit của Deal không còn tồn tại.' });
    }
    if (unit.status === 'maintenance' || unit.status === 'archived') {
      return {
        changed: false,
        action: 'protected-status',
        statusBefore: unit.status,
        statusAfter: unit.status,
        availableFromBefore: dateOnly(unit.available_from),
        availableFromAfter: dateOnly(unit.available_from),
      };
    }
    await client.query(
      `UPDATE room_units
       SET status = 'available', available_from = NULL, updated_at = NOW()
       WHERE id = $1`,
      [roomUnitId],
    );
    return {
      changed: unit.status !== 'available' || unit.available_from !== null,
      action: 'release',
      statusBefore: unit.status,
      statusAfter: 'available',
      availableFromBefore: dateOnly(unit.available_from),
      availableFromAfter: null,
    };
  }

  async list(identity: AppIdentity, query: DealListQuery) {
    const search = query.search.trim();
    const pattern = escapedLike(search);
    const sortColumn = {
      createdAt: 'd.created_at',
      customerName: 'lower(customer.name)',
      finalPrice: 'd.final_price',
      rentalStartDate: 'd.rental_start_date',
    }[query.sort] || 'd.created_at';
    const order = query.order === 'asc' ? 'ASC' : 'DESC';
    const accessMode = this.accessMode(identity);
    if (accessMode === 'none') {
      throw new ForbiddenException({ error: 'Bạn không có quyền xem giao dịch thuê.' });
    }
    const where = `
      WHERE (
        $1 = 'all'
        OR ($1 = 'assigned' AND COALESCE(d.assigned_user_id, booking.assigned_user_id) = $2)
      )
      AND (
        $3 = ''
        OR d.id ILIKE $4
        OR COALESCE(d.booking_id, '') ILIKE $4
        OR customer.name ILIKE $4
        OR customer.phone ILIKE $4
        OR unit.code ILIKE $4
        OR room.type ILIKE $4
        OR building.code ILIKE $4
        OR building.name ILIKE $4
        OR COALESCE(collaborator.name, '') ILIKE $4
      )
      AND ($5 = '' OR d.booking_id = $5)
      AND ($6 = '' OR d.customer_id = $6)
      AND ($7 = '' OR d.lifecycle_status = $7)
      AND (
        $8 = ''
        OR ($8 = 'scheduled' AND d.rental_start_date IS NOT NULL)
        OR ($8 = 'unscheduled' AND d.rental_start_date IS NULL AND d.rental_end_date IS NULL)
        OR ($8 = 'complete' AND d.rental_start_date IS NOT NULL AND d.rental_end_date IS NOT NULL)
        OR ($8 = 'partial' AND d.rental_start_date IS NOT NULL AND d.rental_end_date IS NULL)
      )
      AND (
        ($9 = '' AND $10 = '')
        OR (
          d.rental_start_date IS NOT NULL
          AND (
            (
              d.rental_end_date IS NOT NULL
              AND ($10 = '' OR d.rental_start_date <= $10::date)
              AND ($9 = '' OR d.rental_end_date >= $9::date)
            )
            OR (
              d.rental_end_date IS NULL
              AND ($9 = '' OR d.rental_start_date >= $9::date)
              AND ($10 = '' OR d.rental_start_date <= $10::date)
            )
          )
        )
      )
    `;
    const params = [
      accessMode,
      identity.id,
      search,
      pattern,
      query.bookingId,
      query.customerId,
      query.lifecycleStatus,
      query.rentalSchedule,
      query.rentalDateFrom,
      query.rentalDateTo,
    ];
    const [rows, count] = await Promise.all([
      this.db.query(
        `${DEAL_SELECT} ${where}
         ORDER BY ${sortColumn} ${order}, d.id DESC
         LIMIT $11 OFFSET $12`,
        [...params, query.pageSize, pageOffset(query.page, query.pageSize)],
      ),
      this.db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count
         ${DEAL_SELECT.slice(DEAL_SELECT.indexOf('FROM deals'))}
         ${where}`,
        params,
      ),
    ]);
    return pageResult(
      rows.rows.map(mapDeal),
      query.page,
      query.pageSize,
      Number(count.rows[0]?.count || 0),
    );
  }

  async detail(identity: AppIdentity, id: string) {
    const accessMode = this.accessMode(identity);
    if (accessMode === 'none') {
      throw new ForbiddenException({ error: 'Bạn không có quyền xem giao dịch thuê.' });
    }
    const result = await this.db.query(
      `${DEAL_SELECT}
       WHERE d.id = $1
         AND (
           $2 = 'all'
           OR ($2 = 'assigned' AND COALESCE(d.assigned_user_id, booking.assigned_user_id) = $3)
         )
       LIMIT 1`,
      [id, accessMode, identity.id],
    );
    if (!result.rows[0]) {
      throw new NotFoundException({ error: 'Không tìm thấy giao dịch thuê.' });
    }
    return mapDeal(result.rows[0]);
  }

  async assignees(identity: AppIdentity) {
    if (this.accessMode(identity) === 'none') {
      throw new ForbiddenException({ error: 'Bạn không có quyền xem danh sách người phụ trách giao dịch.' });
    }
    const result = await this.db.query<{
      id: string;
      name: string;
      email: string;
      role_code: string;
      role_name: string;
      deal_scope: 'all' | 'assigned';
    }>(
      `SELECT u.id, u.name, u.email, u.role_code,
              COALESCE(r.name, u.role_name, u.role_code) AS role_name,
              r.deal_scope
       FROM users u
       JOIN roles r ON lower(r.code) = lower(u.role_code)
       WHERE lower(btrim(u.status)) IN ('hoạt động', 'active', 'approved', 'enabled')
         AND r.deal_scope IN ('all', 'assigned')
         AND (
           COALESCE(r.allowed_screens, '[]'::jsonb) ? 'deals'
           OR COALESCE(r.allowed_screens, '[]'::jsonb) ? '*'
         )
       ORDER BY CASE WHEN r.deal_scope = 'assigned' THEN 0 ELSE 1 END, lower(u.name), lower(u.email)
       LIMIT 100`,
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name || '',
      email: row.email || '',
      roleCode: row.role_code || '',
      roleName: row.role_name || '',
      dealScope: row.deal_scope,
    }));
  }

  async updateAssignment(
    actor: AppIdentity,
    id: string,
    data: DealAssignmentRequest,
  ) {
    if (actor.dealScope !== 'all' || !actor.dealCanManageLifecycle) {
      throw new ForbiddenException({ error: 'Bạn không có quyền phân công giao dịch.' });
    }
    await this.db.transaction(async (client) => {
      const currentResult = await client.query<{
        lifecycle_status: string;
        assigned_user_id: string | null;
      } & QueryResultRow>(
        'SELECT lifecycle_status, assigned_user_id FROM deals WHERE id = $1 FOR UPDATE',
        [id],
      );
      const current = currentResult.rows[0];
      if (!current) throw new NotFoundException({ error: 'Không tìm thấy giao dịch thuê.' });
      if (current.lifecycle_status === 'cancelled') {
        throw new ConflictException({ error: 'Giao dịch đã hủy không thể phân công lại.' });
      }
      const assignee = await this.resolveAssignee(client, data.assignedUserId);
      if ((current.assigned_user_id || null) === data.assignedUserId) return;
      await client.query(
        'UPDATE deals SET assigned_user_id = $2, updated_at = NOW() WHERE id = $1',
        [id, data.assignedUserId],
      );
      await this.appendActivity(
        client,
        id,
        this.activityEvent(
          actor,
          'assignment',
          data.assignedUserId ? 'Đã phân công người phụ trách' : 'Đã gỡ người phụ trách',
          assignee ? `${assignee.name} · ${assignee.email}` : '',
        ),
      );
    });
    await this.audit.create({
      user: actor,
      action: 'UPDATE',
      entityType: 'deal',
      entityId: id,
      summary: `${actor.name || 'Admin'} đã cập nhật người phụ trách Deal ${id}`,
      metadata: { assignedUserId: data.assignedUserId },
    }).catch(() => undefined);
    return this.detail(actor, id);
  }

  async addNote(
    actor: AppIdentity,
    id: string,
    data: DealNoteRequest,
  ) {
    if (actor.dealScope !== 'all' || !actor.dealCanManageLifecycle) {
      throw new ForbiddenException({ error: 'Bạn không có quyền thêm ghi chú giao dịch.' });
    }
    await this.db.transaction(async (client) => {
      const current = await client.query<{ lifecycle_status: string } & QueryResultRow>(
        'SELECT lifecycle_status FROM deals WHERE id = $1 FOR UPDATE',
        [id],
      );
      if (!current.rows[0]) throw new NotFoundException({ error: 'Không tìm thấy giao dịch thuê.' });
      await client.query(
        'UPDATE deals SET notes = $2, updated_at = NOW() WHERE id = $1',
        [id, data.note],
      );
      await this.appendActivity(
        client,
        id,
        this.activityEvent(actor, 'note', 'Đã thêm ghi chú', data.note),
      );
    });
    await this.audit.create({
      user: actor,
      action: 'UPDATE',
      entityType: 'deal',
      entityId: id,
      summary: `${actor.name || 'Admin'} đã thêm ghi chú cho Deal ${id}`,
      metadata: { section: 'note' },
    }).catch(() => undefined);
    return this.detail(actor, id);
  }

  async updateCommercialTerms(
    actor: AppIdentity,
    id: string,
    data: UpdateDealCommercialTermsRequest,
  ) {
    if (actor.dealScope !== 'all' || !actor.dealCanManageContractDeposit) {
      throw new ForbiddenException({ error: 'Bạn không có quyền cập nhật giá thuê và thời hạn hợp đồng.' });
    }

    const change = await this.db.transaction(async (client) => {
      const currentResult = await client.query<{
        lifecycle_status: string;
        final_price: string | number;
        contract_months: number | null;
      } & QueryResultRow>(
        'SELECT lifecycle_status, final_price, contract_months FROM deals WHERE id = $1 FOR UPDATE',
        [id],
      );
      const current = currentResult.rows[0];
      if (!current) {
        throw new NotFoundException({ error: 'Không tìm thấy giao dịch thuê.' });
      }
      if (current.lifecycle_status === 'cancelled') {
        throw new ConflictException({ error: 'Deal đã hủy không thể cập nhật điều khoản thuê.' });
      }

      const previousFinalPrice = Number(current.final_price || 0);
      const previousContractMonths = current.contract_months === null
        ? null
        : Number(current.contract_months);

      await client.query(
        `UPDATE deals
         SET final_price = $2,
             contract_months = $3,
             updated_at = NOW()
         WHERE id = $1`,
        [id, data.finalPrice, data.contractMonths],
      );

      await this.appendActivity(
        client,
        id,
        this.activityEvent(
          actor,
          'commercial-terms',
          'Đã cập nhật điều khoản thuê',
          `Giá thuê/tháng: ${Number(data.finalPrice).toLocaleString('vi-VN')} đ · Thời hạn: ${data.contractMonths === null ? 'chưa xác định' : `${data.contractMonths} tháng`}`,
        ),
      );

      return {
        previousFinalPrice,
        finalPrice: data.finalPrice,
        previousContractMonths,
        contractMonths: data.contractMonths,
      };
    });

    await this.audit.create({
      user: actor,
      action: 'UPDATE',
      entityType: 'deal',
      entityId: id,
      summary: `${actor.name || 'Admin'} đã cập nhật điều khoản thuê Deal ${id}`,
      metadata: {
        section: 'commercial-terms',
        ...change,
      },
    }).catch(() => undefined);

    return this.detail(actor, id);
  }

  async updateContractDeposit(
    actor: AppIdentity,
    id: string,
    data: UpdateDealContractDepositRequest,
  ) {
    if (actor.dealScope !== 'all' || !actor.dealCanManageContractDeposit) {
      throw new ForbiddenException({ error: 'Bạn không có quyền cập nhật hợp đồng và tiền cọc.' });
    }

    const change = await this.db.transaction(async (client) => {
      const currentResult = await client.query<{
        id: string;
        lifecycle_status: string;
        contract_signed_at: Date | string | null;
        deposit_required_amount: string | number | null;
        deposit_paid_amount: string | number | null;
        room_unit_id: string;
        rental_end_date: Date | string | null;
      } & QueryResultRow>(
        `SELECT id, lifecycle_status, contract_signed_at, deposit_required_amount, deposit_paid_amount,
                room_unit_id, rental_end_date
         FROM deals
         WHERE id = $1
         FOR UPDATE`,
        [id],
      );
      const current = currentResult.rows[0];
      if (!current) {
        throw new NotFoundException({ error: 'Không tìm thấy giao dịch thuê.' });
      }
      if (current.lifecycle_status === 'cancelled') {
        throw new ConflictException({ error: 'Deal đã hủy không thể cập nhật hợp đồng/cọc.' });
      }

      const previousSignedAt = iso(current.contract_signed_at);
      const nextSignedAt = data.contractSigned
        ? previousSignedAt || new Date().toISOString()
        : null;
      const previousRequired = current.deposit_required_amount === null
        ? null
        : Number(current.deposit_required_amount);
      const previousPaid = Number(current.deposit_paid_amount || 0);
      const beforeComplete = this.contractDepositComplete(
        current.contract_signed_at,
        current.deposit_required_amount,
        current.deposit_paid_amount,
      );
      const afterComplete = this.contractDepositComplete(
        nextSignedAt,
        data.depositRequiredAmount,
        data.depositPaidAmount,
      );

      await client.query(
        `UPDATE deals
         SET contract_signed_at = $2::timestamptz,
             deposit_required_amount = $3,
             deposit_paid_amount = $4,
             updated_at = NOW()
         WHERE id = $1`,
        [id, nextSignedAt, data.depositRequiredAmount, data.depositPaidAmount],
      );

      let inventorySync: Record<string, unknown> = {
        changed: false,
        action: 'none',
      };
      let commissionSync: Record<string, unknown> | null = null;
      if (!beforeComplete && afterComplete) {
        inventorySync = await this.setOccupiedForDeal(
          client,
          current.room_unit_id,
          current.rental_end_date,
        );
        commissionSync = await this.commissionLedger.ensureForEligibleDeal(client, id);
      } else if (beforeComplete && !afterComplete) {
        inventorySync = {
          changed: false,
          action: 'no-auto-release',
          reason: 'contract-deposit-completion-reversed',
        };
        const flagged = await this.commissionLedger.flagReview(
          client,
          id,
          'contract_deposit_completion_reversed',
        );
        commissionSync = flagged
          ? { action: 'review-required', ledger: flagged }
          : { action: 'no-ledger' };
      } else if (afterComplete) {
        commissionSync = await this.commissionLedger.ensureForEligibleDeal(client, id);
      }

      await this.appendActivity(
        client,
        id,
        this.activityEvent(
          actor,
          'contract-deposit',
          'Cập nhật hợp đồng & tiền cọc',
          `${data.contractSigned ? 'Đã xác nhận ký hợp đồng' : 'Chưa xác nhận ký'} · Cọc ${data.depositPaidAmount.toLocaleString('vi-VN')} / ${data.depositRequiredAmount === null ? 'chưa xác định' : data.depositRequiredAmount.toLocaleString('vi-VN')}`,
        ),
      );

      return {
        before: {
          contractSignedAt: previousSignedAt,
          depositRequiredAmount: previousRequired,
          depositPaidAmount: previousPaid,
        },
        after: {
          contractSignedAt: nextSignedAt,
          depositRequiredAmount: data.depositRequiredAmount,
          depositPaidAmount: data.depositPaidAmount,
          depositFullyPaid: data.depositRequiredAmount !== null
            && data.depositRequiredAmount > 0
            && data.depositPaidAmount >= data.depositRequiredAmount,
          contractDepositComplete: afterComplete,
        },
        inventorySync,
        commissionSync,
      };
    });

    await this.audit.create({
      user: actor,
      action: 'UPDATE',
      entityType: 'deal',
      entityId: id,
      summary: `${actor?.name || 'Admin'} đã cập nhật dữ kiện hợp đồng/cọc của ${id}`,
      metadata: {
        section: 'contract-deposit',
        before: change.before,
        after: change.after,
        inventorySync: change.inventorySync,
        commissionSync: change.commissionSync,
      },
    }).catch(() => undefined);

    return this.detail(actor, id);
  }

  async updateRentalSchedule(
    actor: AppIdentity,
    id: string,
    data: UpdateDealRentalScheduleRequest,
  ) {
    if (actor.dealScope !== 'all' || !actor.dealCanManageRentalSchedule) {
      throw new ForbiddenException({ error: 'Bạn không có quyền cập nhật lịch thuê.' });
    }

    const change = await this.db.transaction(async (client) => {
      const currentResult = await client.query<{
        id: string;
        lifecycle_status: string;
        rental_start_date: Date | string | null;
        rental_end_date: Date | string | null;
        contract_signed_at: Date | string | null;
        deposit_required_amount: string | number | null;
        deposit_paid_amount: string | number | null;
        room_unit_id: string;
      } & QueryResultRow>(
        `SELECT id, lifecycle_status, rental_start_date, rental_end_date,
                contract_signed_at, deposit_required_amount, deposit_paid_amount, room_unit_id
         FROM deals
         WHERE id = $1
         FOR UPDATE`,
        [id],
      );
      const current = currentResult.rows[0];
      if (!current) {
        throw new NotFoundException({ error: 'Không tìm thấy giao dịch thuê.' });
      }
      if (current.lifecycle_status === 'cancelled') {
        throw new ConflictException({ error: 'Deal đã hủy không thể cập nhật lịch thuê.' });
      }

      const before = {
        rentalStartDate: dateOnly(current.rental_start_date),
        rentalEndDate: dateOnly(current.rental_end_date),
      };
      await client.query(
        `UPDATE deals
         SET rental_start_date = $2::date,
             rental_end_date = $3::date,
             updated_at = NOW()
         WHERE id = $1`,
        [id, data.rentalStartDate, data.rentalEndDate],
      );
      let inventorySync: Record<string, unknown> = {
        changed: false,
        action: 'none',
      };
      if (this.contractDepositComplete(
        current.contract_signed_at,
        current.deposit_required_amount,
        current.deposit_paid_amount,
      )) {
        const unitResult = await client.query<{
          status: string;
          available_from: Date | string | null;
        } & QueryResultRow>(
          'SELECT status, available_from FROM room_units WHERE id = $1 FOR UPDATE',
          [current.room_unit_id],
        );
        const unit = unitResult.rows[0];
        if (unit?.status === 'occupied') {
          await client.query(
            'UPDATE room_units SET available_from = $2::date, updated_at = NOW() WHERE id = $1',
            [current.room_unit_id, data.rentalEndDate],
          );
          inventorySync = {
            changed: dateOnly(unit.available_from) !== data.rentalEndDate,
            action: 'sync-available-from',
            statusBefore: 'occupied',
            statusAfter: 'occupied',
            availableFromBefore: dateOnly(unit.available_from),
            availableFromAfter: data.rentalEndDate,
          };
        }
      }

      await this.appendActivity(
        client,
        id,
        this.activityEvent(
          actor,
          'rental-schedule',
          'Cập nhật lịch thuê',
          `${data.rentalStartDate || 'Chưa có ngày bắt đầu'} → ${data.rentalEndDate || 'Chưa xác định'}`,
        ),
      );
      return {
        before,
        after: {
          rentalStartDate: data.rentalStartDate,
          rentalEndDate: data.rentalEndDate,
        },
        inventorySync,
      };
    });

    await this.audit.create({
      user: actor,
      action: 'UPDATE',
      entityType: 'deal',
      entityId: id,
      summary: `${actor?.name || 'Admin'} đã cập nhật lịch thuê của ${id}`,
      metadata: {
        section: 'rental-schedule',
        before: change.before,
        after: change.after,
        inventorySync: change.inventorySync,
      },
    }).catch(() => undefined);

    return this.detail(actor, id);
  }

  async roomUnitHistory(actor: AppIdentity, id: string) {
    await this.detail(actor, id);
    const result = await this.db.query(
      `SELECT
         h.id,
         h.deal_id,
         h.from_room_unit_id,
         from_unit.code AS from_room_unit_code,
         h.to_room_unit_id,
         to_unit.code AS to_room_unit_code,
         h.changed_by_user_id,
         COALESCE(u.name, '') AS changed_by_name,
         h.changed_at
       FROM deal_room_unit_history h
       JOIN room_units from_unit ON from_unit.id = h.from_room_unit_id
       JOIN room_units to_unit ON to_unit.id = h.to_room_unit_id
       LEFT JOIN users u ON u.id = h.changed_by_user_id
       WHERE h.deal_id = $1
       ORDER BY h.changed_at DESC, h.id DESC`,
      [id],
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      dealId: String(row.deal_id),
      fromRoomUnitId: String(row.from_room_unit_id),
      fromRoomUnitCode: String(row.from_room_unit_code || ''),
      toRoomUnitId: String(row.to_room_unit_id),
      toRoomUnitCode: String(row.to_room_unit_code || ''),
      changedByUserId: row.changed_by_user_id ? String(row.changed_by_user_id) : null,
      changedByName: String(row.changed_by_name || ''),
      changedAt: iso(row.changed_at) || new Date(0).toISOString(),
    }));
  }

  async changeRoomUnit(actor: AppIdentity, id: string, data: ChangeDealRoomUnitRequest) {
    if (actor.dealScope !== 'all' || !actor.dealCanManageLifecycle) {
      throw new ForbiddenException({ error: 'Bạn không có quyền đổi căn của Deal.' });
    }

    const change = await this.db.transaction(async (client) => {
      const currentResult = await client.query<{
        id: string;
        room_unit_id: string;
        lifecycle_status: string;
        contract_signed_at: Date | string | null;
        deposit_required_amount: string | number | null;
        deposit_paid_amount: string | number | null;
        rental_end_date: Date | string | null;
      } & QueryResultRow>(
        `SELECT id, room_unit_id, lifecycle_status, contract_signed_at,
                deposit_required_amount, deposit_paid_amount, rental_end_date
         FROM deals WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const current = currentResult.rows[0];
      if (!current) throw new NotFoundException({ error: 'Không tìm thấy giao dịch thuê.' });
      if (current.lifecycle_status === 'cancelled') {
        throw new ConflictException({ error: 'Deal đã hủy không thể đổi căn.' });
      }
      if (current.room_unit_id === data.roomUnitId) {
        throw new BadRequestException({ error: 'Căn mới trùng với căn hiện tại.' });
      }

      const targetResult = await client.query<{
        id: string;
        code: string;
        status: string;
      } & QueryResultRow>(
        `SELECT u.id, u.code, u.status
         FROM room_units u
         JOIN rooms r ON r.id = u.room_type_id
         JOIN buildings b ON b.id = u.building_id
         WHERE u.id = $1
           AND u.status = 'available'
           AND r.lifecycle_status = 'active'
           AND r.deleted_at IS NULL
           AND b.deleted_at IS NULL
         LIMIT 1
         FOR UPDATE OF u`,
        [data.roomUnitId],
      );
      const target = targetResult.rows[0];
      if (!target) {
        throw new ConflictException({
          error: 'Căn mới phải đang available và thuộc tòa/loại phòng đang hoạt động.',
        });
      }

      const conflictingDealId = await this.activeDealForRoomUnit(
        client,
        target.id,
        id,
      );
      if (conflictingDealId) {
        throw new ConflictException({
          error: `Căn ${target.code} đang gắn với Deal active ${conflictingDealId}. Mỗi Room Unit chỉ có tối đa 1 Deal active.`,
        });
      }

      const previousUnit = await client.query<{
        code: string;
        status: string;
        available_from: Date | string | null;
      } & QueryResultRow>(
        'SELECT code, status, available_from FROM room_units WHERE id = $1 FOR UPDATE',
        [current.room_unit_id],
      );
      const historyId = `DRH-${Date.now()}-${crypto.randomInt(100, 999)}`;
      await client.query(
        `INSERT INTO deal_room_unit_history (
           id, deal_id, from_room_unit_id, to_room_unit_id, changed_by_user_id, changed_at
         ) VALUES ($1,$2,$3,$4,$5,NOW())`,
        [historyId, id, current.room_unit_id, target.id, actor.id || null],
      );
      const oldInventorySync = await this.releaseRoomUnit(client, current.room_unit_id);
      const complete = this.contractDepositComplete(
        current.contract_signed_at,
        current.deposit_required_amount,
        current.deposit_paid_amount,
      );
      const newInventorySync = complete
        ? await this.setOccupiedForDeal(client, target.id, current.rental_end_date)
        : {
            changed: false,
            action: 'keep-available',
            statusBefore: target.status,
            statusAfter: target.status,
            availableFromBefore: null,
            availableFromAfter: null,
          };

      await client.query(
        `UPDATE deals SET room_unit_id = $2, updated_at = NOW() WHERE id = $1`,
        [id, target.id],
      );
      const commissionReview = await this.commissionLedger.flagReview(
        client,
        id,
        'room_unit_changed_after_eligibility',
      );

      await this.appendActivity(
        client,
        id,
        this.activityEvent(
          actor,
          'room-unit',
          'Đổi căn thuê',
          `${String(previousUnit.rows[0]?.code || '')} → ${target.code}`,
        ),
      );
      return {
        fromRoomUnitId: current.room_unit_id,
        fromRoomUnitCode: String(previousUnit.rows[0]?.code || ''),
        toRoomUnitId: target.id,
        toRoomUnitCode: target.code,
        oldInventorySync,
        newInventorySync,
        commissionReview,
      };
    });

    await this.audit.create({
      user: actor,
      action: 'UPDATE',
      entityType: 'deal',
      entityId: id,
      summary: `${actor?.name || 'Admin'} đã đổi căn Deal ${id}: ${change.fromRoomUnitCode} → ${change.toRoomUnitCode}`,
      metadata: {
        section: 'room-unit',
        ...change,
        inventoryStatusChanged: Boolean(
          change.oldInventorySync.changed || change.newInventorySync.changed,
        ),
      },
    }).catch(() => undefined);

    return this.detail(actor, id);
  }

  async cancel(actor: AppIdentity, id: string, data: CancelDealRequest) {
    if (actor.dealScope !== 'all' || !actor.dealCanManageLifecycle) {
      throw new ForbiddenException({ error: 'Bạn không có quyền hủy Deal.' });
    }

    const change = await this.db.transaction(async (client) => {
      const currentResult = await client.query<{
        id: string;
        room_unit_id: string;
        lifecycle_status: string;
      } & QueryResultRow>(
        'SELECT id, room_unit_id, lifecycle_status FROM deals WHERE id = $1 FOR UPDATE',
        [id],
      );
      const current = currentResult.rows[0];
      if (!current) throw new NotFoundException({ error: 'Không tìm thấy giao dịch thuê.' });
      if (current.lifecycle_status === 'cancelled') {
        throw new ConflictException({ error: 'Deal đã hủy; không có thao tác mở lại trong U06.4.' });
      }

      const inventorySync = await this.releaseRoomUnit(client, current.room_unit_id);
      const result = await client.query<{ cancelled_at: Date | string } & QueryResultRow>(
        `UPDATE deals
         SET lifecycle_status = 'cancelled',
             cancelled_at = NOW(),
             cancellation_reason = $2,
             updated_at = NOW()
         WHERE id = $1
         RETURNING cancelled_at`,
        [id, data.reason || ''],
      );
      const commissionReview = await this.commissionLedger.flagReview(
        client,
        id,
        'deal_cancelled',
      );

      await this.appendActivity(
        client,
        id,
        this.activityEvent(
          actor,
          'cancel',
          'Đã hủy giao dịch',
          data.reason || 'Không có lý do được ghi nhận.',
        ),
      );
      return {
        roomUnitId: current.room_unit_id,
        cancelledAt: iso(result.rows[0]?.cancelled_at),
        inventorySync,
        commissionReview,
      };
    });

    await this.audit.create({
      user: actor,
      action: 'UPDATE',
      entityType: 'deal',
      entityId: id,
      summary: `${actor?.name || 'Admin'} đã hủy Deal ${id}`,
      metadata: {
        section: 'lifecycle',
        transition: 'cancel',
        lifecycleStatus: 'cancelled',
        reason: data.reason || '',
        roomUnitId: change.roomUnitId,
        cancelledAt: change.cancelledAt,
        inventorySync: change.inventorySync,
        commissionReview: change.commissionReview,
        inventoryStatusChanged: Boolean(change.inventorySync.changed),
      },
    }).catch(() => undefined);

    return this.detail(actor, id);
  }

  async createFromBooking(
    data: CreateDealFromBookingRequest,
    actor: AppIdentity,
  ) {
    if (actor.dealScope !== 'all' || !actor.dealCanCreate) {
      throw new ForbiddenException({ error: 'Bạn không có quyền tạo giao dịch thuê từ lịch xem.' });
    }
    const createdId = await this.db.transaction(async (client) => {
      const bookingResult = await client.query<{
        id: string;
        status: string;
        customer_id: string | null;
        assigned_user_id: string | null;
        collaborator_id: string | null;
        source_type: string | null;
        source_channel: string | null;
        source_recorded_at: string | Date | null;
        customer_source_type: string | null;
        customer_source_channel: string | null;
        customer_source_recorded_at: string | Date | null;
        referred_by_collaborator_id: string | null;
      } & QueryResultRow>(
        `
          SELECT
            b.id,
            b.status,
            b.customer_id,
            b.assigned_user_id,
            b.collaborator_id,
            b.source_type,
            b.source_channel,
            b.source_recorded_at,
            c.source_type AS customer_source_type,
            c.source_channel AS customer_source_channel,
            c.source_recorded_at AS customer_source_recorded_at,
            c.referred_by_collaborator_id
          FROM bookings b
          LEFT JOIN customers c ON c.id = b.customer_id
          WHERE b.id = $1
          FOR UPDATE OF b
        `,
        [data.bookingId],
      );
      const booking = bookingResult.rows[0];
      if (!booking) {
        throw new NotFoundException({ error: 'Không tìm thấy lịch xem nguồn.' });
      }
      if (!['Đã xem phòng', 'Đã cọc', 'Đã chốt'].includes(booking.status)) {
        throw new ConflictException({
          error: 'Chỉ tạo giao dịch thuê sau khi khách đã xem phòng. Trường hợp thuê trực tiếp hãy dùng luồng tạo Deal trực tiếp.',
        });
      }
      if (!booking.customer_id) {
        throw new BadRequestException({
          error: 'Lịch xem chưa liên kết Customer ID canonical. Hãy liên kết khách hàng trước khi tạo giao dịch.',
        });
      }

      const existingDeal = await client.query<{ id: string } & QueryResultRow>(
        'SELECT id FROM deals WHERE booking_id = $1 LIMIT 1',
        [booking.id],
      );
      if (existingDeal.rows[0]) {
        throw new ConflictException({
          error: `Lịch xem ${booking.id} đã có Deal ${existingDeal.rows[0].id}. Quan hệ Booking → Deal là 1-1.`,
        });
      }

      const customerResult = await client.query<{
        id: string;
        archived_at: string | Date | null;
      } & QueryResultRow>(
        'SELECT id, archived_at FROM customers WHERE id = $1 FOR UPDATE',
        [booking.customer_id],
      );
      const customer = customerResult.rows[0];
      if (!customer || customer.archived_at) {
        throw new BadRequestException({
          error: 'Khách hàng của lịch xem không còn là hồ sơ hoạt động.',
        });
      }

      const unitResult = await client.query<{
        id: string;
        code: string;
        status: string;
        room_type_id: string;
        building_id: string;
      } & QueryResultRow>(
        `
          SELECT u.id, u.code, u.status, u.room_type_id, u.building_id
          FROM room_units u
          JOIN rooms r ON r.id = u.room_type_id
          JOIN buildings b ON b.id = u.building_id
          WHERE u.id = $1
            AND u.status = 'available'
            AND r.lifecycle_status = 'active'
            AND r.deleted_at IS NULL
            AND b.deleted_at IS NULL
          LIMIT 1
          FOR UPDATE OF u
        `,
        [data.roomUnitId],
      );
      const unit = unitResult.rows[0];
      if (!unit) {
        throw new ConflictException({
          error: 'Căn thuê thực tế phải đang available và thuộc tòa/loại phòng hoạt động.',
        });
      }
      const activeDealId = await this.activeDealForRoomUnit(client, unit.id);
      if (activeDealId) {
        throw new ConflictException({
          error: `Căn ${unit.code} đang gắn với Deal active ${activeDealId}. Mỗi Room Unit chỉ có tối đa 1 Deal active.`,
        });
      }

      const collaboratorId =
        booking.collaborator_id || booking.referred_by_collaborator_id || null;
      const sourceType =
        String(booking.source_type || booking.customer_source_type || (collaboratorId ? 'ctv' : ''));
      const sourceChannel =
        String(booking.source_channel || booking.customer_source_channel || '');
      const sourceRecordedAt =
        booking.source_recorded_at || booking.customer_source_recorded_at || null;

      const id = `DL-${Date.now()}-${crypto.randomInt(100, 999)}`;
      const createEvent = this.activityEvent(
        actor,
        'create',
        'Đã tạo giao dịch từ lịch xem',
        `${booking.id} · Căn ${unit.code}`,
      );
      await client.query(
        `
          INSERT INTO deals (
            id, booking_id, customer_id, collaborator_id,
            source_type, source_channel, source_recorded_at,
            assigned_user_id, notes, activity_log,
            room_unit_id, final_price, contract_months, created_at, updated_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10::jsonb,$11,$12,$13,NOW(),NOW()
          )
        `,
        [
          id,
          booking.id,
          booking.customer_id,
          collaboratorId,
          sourceType,
          sourceChannel,
          sourceRecordedAt,
          booking.assigned_user_id || null,
          data.notes || '',
          JSON.stringify([createEvent]),
          unit.id,
          data.finalPrice,
          data.contractMonths,
        ],
      );
      return id;
    });

    await this.audit.create({
      user: actor,
      action: 'CREATE',
      entityType: 'deal',
      entityId: createdId,
      summary: `${actor?.name || 'Admin'} đã tạo giao dịch thuê ${createdId} từ lịch ${data.bookingId}`,
      metadata: {
        bookingId: data.bookingId,
        roomUnitId: data.roomUnitId,
        finalPrice: data.finalPrice,
        contractMonths: data.contractMonths,
        priceSemantics: 'monthly-rent',
        mode: 'from-booking',
      },
    }).catch(() => undefined);

    return this.detail(actor, createdId);
  }

  async createDirect(
    data: CreateDealDirectRequest,
    actor: AppIdentity,
  ) {
    if (actor.dealScope !== 'all' || !actor.dealCanCreate || !actor.dealCanCreateDirect) {
      throw new ForbiddenException({ error: 'Bạn không có quyền tạo giao dịch thuê trực tiếp.' });
    }
    const createdId = await this.db.transaction(async (client) => {
      const customerResult = await client.query<{
        id: string;
        archived_at: string | Date | null;
        source_type: string | null;
        source_channel: string | null;
        source_recorded_at: string | Date | null;
        referred_by_collaborator_id: string | null;
      } & QueryResultRow>(
        `SELECT id, archived_at, source_type, source_channel, source_recorded_at,
                referred_by_collaborator_id
         FROM customers
         WHERE id = $1
         FOR UPDATE`,
        [data.customerId],
      );
      const customer = customerResult.rows[0];
      if (!customer || customer.archived_at) {
        throw new BadRequestException({
          error: 'Khách hàng không tồn tại hoặc đã lưu trữ.',
        });
      }

      const unitResult = await client.query<{
        id: string;
        code: string;
        status: string;
        room_type_id: string;
        building_id: string;
      } & QueryResultRow>(
        `
          SELECT u.id, u.code, u.status, u.room_type_id, u.building_id
          FROM room_units u
          JOIN rooms r ON r.id = u.room_type_id
          JOIN buildings b ON b.id = u.building_id
          WHERE u.id = $1
            AND u.status = 'available'
            AND r.lifecycle_status = 'active'
            AND r.deleted_at IS NULL
            AND b.deleted_at IS NULL
          LIMIT 1
          FOR UPDATE OF u
        `,
        [data.roomUnitId],
      );
      const unit = unitResult.rows[0];
      if (!unit) {
        throw new ConflictException({
          error: 'Căn thuê thực tế phải đang available và thuộc tòa/loại phòng hoạt động.',
        });
      }
      const activeDealId = await this.activeDealForRoomUnit(client, unit.id);
      if (activeDealId) {
        throw new ConflictException({
          error: `Căn ${unit.code} đang gắn với Deal active ${activeDealId}. Mỗi Room Unit chỉ có tối đa 1 Deal active.`,
        });
      }

      const collaboratorId = customer.referred_by_collaborator_id || null;
      const sourceType = String(customer.source_type || (collaboratorId ? 'ctv' : ''));
      const sourceChannel = String(customer.source_channel || '');
      const sourceRecordedAt = customer.source_recorded_at || null;
      const assignee = await this.resolveAssignee(client, data.assignedUserId || null);
      const id = `DL-${Date.now()}-${crypto.randomInt(100, 999)}`;
      const createEvent = this.activityEvent(
        actor,
        'create',
        'Đã tạo giao dịch trực tiếp',
        `Căn ${unit.code}${assignee ? ` · Phụ trách ${assignee.name}` : ''}`,
      );

      await client.query(
        `
          INSERT INTO deals (
            id, booking_id, customer_id, collaborator_id,
            source_type, source_channel, source_recorded_at,
            assigned_user_id, notes, activity_log,
            room_unit_id, final_price, contract_months, created_at, updated_at
          ) VALUES (
            $1,NULL,$2,$3,$4,$5,$6::timestamptz,$7,$8,$9::jsonb,$10,$11,$12,NOW(),NOW()
          )
        `,
        [
          id,
          customer.id,
          collaboratorId,
          sourceType,
          sourceChannel,
          sourceRecordedAt,
          data.assignedUserId || null,
          data.notes || '',
          JSON.stringify([createEvent]),
          unit.id,
          data.finalPrice,
          data.contractMonths,
        ],
      );
      return id;
    });

    await this.audit.create({
      user: actor,
      action: 'CREATE',
      entityType: 'deal',
      entityId: createdId,
      summary: `${actor?.name || 'Admin'} đã tạo giao dịch thuê trực tiếp ${createdId}`,
      metadata: {
        customerId: data.customerId,
        roomUnitId: data.roomUnitId,
        finalPrice: data.finalPrice,
        contractMonths: data.contractMonths,
        priceSemantics: 'monthly-rent',
        mode: 'direct',
      },
    }).catch(() => undefined);

    return this.detail(actor, createdId);
  }
}
