import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import crypto from 'crypto';
import type { PoolClient, QueryResultRow } from 'pg';
import type { AppIdentity } from '../../common/auth/auth.types.js';
import {
  BOOKING_MIN_LEAD_MS,
  bookingAppointmentAt,
  bookingCanRescheduleStatus,
  bookingPublicReceiptSchema,
  bookingRoomUnitEligibility,
  bookingStatusSchema,
  bookingSelfSchema,
  type BookingSelfLinkRequest,
  bookingTransitionTarget,
  normalizeBookingTime24h,
  type BookingAssigneeListQuery,
  type BookingRescheduleRequest,
  type BookingTransition,
  type BookingListQuery,
  type CreateAdminBookingRequest,
  type CreateBookingRequest,
} from '@tinyhouse/contracts';
import { PostgresService } from '../../database/postgres.service.js';
import { mapBookingRow } from '../../database/row-mappers.js';
import { AuditService } from '../audit/audit.service.js';
import { AffiliateService } from '../affiliate/affiliate.service.js';
import { EmailService } from '../../common/email/email.service.js';
import { escapedLike, pageOffset, pageResult } from '../../common/list/list-utils.js';

const BOOKING_SELECT = `
  SELECT
    b.*,
    COALESCE(building.name, unit_building.name, '') AS building_name,
    COALESCE(canonical_unit.id, legacy_unit.id) AS resolved_room_unit_id,
    COALESCE(canonical_unit.code, legacy_unit.code, b.room_number, '') AS resolved_room_number,
    COALESCE(canonical_unit.room_type_id, b.room_type_id, legacy_unit.room_type_id) AS resolved_room_type_id,
    COALESCE(resolved_room.type, '') AS room_type_name,
    COALESCE(collaborator.name, '') AS collaborator_name,
    COALESCE(assignee.name, '') AS assigned_user_name,
    COALESCE(assignee.email, '') AS assigned_user_email,
    linked_deal.id AS deal_id
  FROM bookings b
  LEFT JOIN room_units canonical_unit ON canonical_unit.id = b.room_unit_id
  LEFT JOIN room_units legacy_unit
    ON b.room_unit_id IS NULL
   AND legacy_unit.building_id = b.building_id
   AND lower(legacy_unit.code) = lower(btrim(COALESCE(b.room_number, '')))
   AND (b.room_type_id IS NULL OR legacy_unit.room_type_id = b.room_type_id)
  LEFT JOIN rooms resolved_room
    ON resolved_room.id = COALESCE(canonical_unit.room_type_id, b.room_type_id, legacy_unit.room_type_id)
  LEFT JOIN buildings building ON building.id = b.building_id
  LEFT JOIN buildings unit_building ON unit_building.id = canonical_unit.building_id
  LEFT JOIN collaborators collaborator ON collaborator.id = b.collaborator_id
  LEFT JOIN users assignee ON assignee.id = b.assigned_user_id
  LEFT JOIN deals linked_deal ON linked_deal.booking_id = b.id
`;

@Injectable()
export class BookingsService {
  constructor(
    private readonly db: PostgresService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly affiliate: AffiliateService,
  ) {}

  private accessMode(identity: AppIdentity) {
    const cmsBookingAccess =
      identity.allowedScreens.includes('*') ||
      identity.allowedScreens.includes('bookings');
    if (!cmsBookingAccess) return 'own' as const;
    if (identity.bookingScope === 'all') return 'all' as const;
    if (identity.bookingScope === 'assigned') return 'assigned' as const;
    return 'none' as const;
  }

  private selfRecord(row: Parameters<typeof mapBookingRow>[0]) {
    return this.projectSelf(mapBookingRow(row));
  }

  private projectSelf(booking: ReturnType<typeof mapBookingRow>) {
    const fields = Object.keys(bookingSelfSchema.shape);
    const wire = JSON.parse(JSON.stringify(booking)) as Record<string, unknown>;
    return bookingSelfSchema.parse(Object.fromEntries(fields.map((key) => [key, wire[key]])));
  }

  selfIdentity(identity: AppIdentity): AppIdentity {
    return { ...identity, allowedScreens: [], bookingScope: 'none' };
  }

  async readDetail(identity: AppIdentity, id: string) {
    const booking = await this.detail(identity, id);
    return this.accessMode(identity) === 'own' ? this.projectSelf(booking) : booking;
  }

  async selfLink(id: string) {
    const result = await this.db.query('SELECT self_user_id FROM bookings WHERE id = $1', [id]);
    if (!result.rows[0]) throw new NotFoundException({ error: 'Không tìm thấy lịch hẹn.' });
    return { id, userId: result.rows[0].self_user_id as string | null };
  }

  async linkSelf(id: string, data: BookingSelfLinkRequest, actor: AppIdentity) {
    if (!['admin', 'superadmin'].includes(actor.roleCode)) {
      throw new ForbiddenException({ error: 'Chỉ Admin/Super Admin được liên kết lịch với tài khoản.' });
    }
    await this.db.transaction(async (client) => {
      const admin = await client.query(`SELECT id FROM users
        WHERE id = $1 AND role_code IN ('admin', 'superadmin')
          AND lower(btrim(status)) IN ('hoạt động', 'active', 'approved', 'enabled')
        FOR SHARE`, [actor.id]);
      if (!admin.rows[0]) throw new ForbiddenException({ error: 'Quyền quản trị đã thay đổi.' });
      const current = (await client.query('SELECT self_user_id FROM bookings WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!current) throw new NotFoundException({ error: 'Không tìm thấy lịch hẹn.' });
      if (current.self_user_id !== data.expectedUserId) {
        throw new ConflictException({ error: 'Liên kết vừa thay đổi. Vui lòng tải lại lịch.' });
      }
      if (data.userId && !(await client.query('SELECT id FROM users WHERE id = $1 FOR KEY SHARE', [data.userId])).rows[0]) {
        throw new BadRequestException({ error: 'Tài khoản liên kết không tồn tại.' });
      }
      await client.query('UPDATE bookings SET self_user_id = $2, updated_at = NOW() WHERE id = $1', [id, data.userId]);
      await client.query(`INSERT INTO audit_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, summary, metadata)
        VALUES ($1,$2,$3,$4,'UPDATE','booking',$5,$6,$7::jsonb)`,
      [crypto.randomUUID(), actor.id, actor.name, actor.email, id, 'Admin xác minh và cập nhật tài khoản được xem lịch',
        JSON.stringify({ action: 'link_self', previousUserId: current.self_user_id, userId: data.userId })]);
    });
    return { id, userId: data.userId };
  }

  private async requireBookingRoomUnit(roomUnitId: string, client?: PoolClient) {
    const execute = <T extends QueryResultRow>(sql: string, params: unknown[]) =>
      client ? client.query<T>(sql, params) : this.db.query<T>(sql, params);
    const result = await execute<{
      id: string;
      code: string;
      room_type_id: string;
      room_type_name: string;
      status: 'available' | 'occupied' | 'maintenance';
      available_from: string | null;
      building_id: string;
      building_code: string;
      building_name: string;
    }>(
      `
        SELECT u.id, u.code, u.room_type_id, r.type AS room_type_name,
               u.status, to_char(u.available_from, 'YYYY-MM-DD') AS available_from,
               u.building_id, b.code AS building_code, b.name AS building_name
        FROM room_units u
        JOIN rooms r ON r.id = u.room_type_id
        JOIN buildings b ON b.id = u.building_id
        WHERE u.id = $1
          AND u.building_id = r.building_id
          AND u.status <> 'archived'
          AND r.lifecycle_status = 'active'
          AND r.deleted_at IS NULL
          AND b.status = 'active'
          AND b.deleted_at IS NULL
        LIMIT 1
        ${client ? 'FOR SHARE OF u, r, b' : ''}
      `,
      [roomUnitId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new BadRequestException({ error: 'Căn xem không tồn tại hoặc không còn hoạt động.' });
    }
    return {
      id: row.id,
      code: row.code,
      roomTypeId: row.room_type_id,
      roomTypeName: row.room_type_name || '',
      status: row.status,
      availableFrom: row.available_from,
      buildingId: row.building_id,
      buildingCode: row.building_code || '',
      buildingName: row.building_name || '',
    };
  }

  async list(identity: AppIdentity, query: BookingListQuery) {
    const accessMode = this.accessMode(identity);
    if (accessMode === 'own' && (query.customerId || query.assignee)) {
      throw new BadRequestException({ error: 'Bộ lọc này chỉ dành cho quản trị.' });
    }
    const search = query.search.trim();
    const pattern = escapedLike(search);
    const sortColumn = {
      createdAt: 'b.created_at',
      appointmentDate: 'b.appointment_date',
      customerName: 'lower(b.customer_name)',
      status: 'lower(b.status)',
    }[query.sort] || 'b.created_at';
    const order = query.order === 'asc' ? 'ASC' : 'DESC';
    const where = `
      WHERE (
        $1 = 'all'
        OR ($1 = 'assigned' AND b.assigned_user_id = $2)
        OR ($1 = 'own' AND b.self_user_id = $2)
      )
        AND (
          $3 = ''
          OR b.customer_name ILIKE $4
          OR b.phone ILIKE $4
          OR ($1 <> 'own' AND b.email ILIKE $4)
          OR b.id ILIKE $4
          OR COALESCE(canonical_unit.code, legacy_unit.code, b.room_number, '') ILIKE $4
          OR b.building_code ILIKE $4
          OR COALESCE(building.name, '') ILIKE $4
          OR COALESCE(resolved_room.type, '') ILIKE $4
          OR ($1 <> 'own' AND (COALESCE(collaborator.name, '') ILIKE $4
            OR COALESCE(assignee.name, '') ILIKE $4))
        )
        AND ($5 = '' OR b.status = $5)
        AND ($6 = '' OR b.building_id = $6 OR lower(b.building_code) = lower($6))
        AND ($7 = '' OR b.appointment_date >= NULLIF($7, '')::date)
        AND ($8 = '' OR b.appointment_date <= NULLIF($8, '')::date)
        AND (
          $9 = ''
          OR ($9 = 'unassigned' AND b.assigned_user_id IS NULL)
          OR ($9 = 'me' AND b.assigned_user_id = $2)
          OR ($9 NOT IN ('unassigned', 'me') AND b.assigned_user_id = $9)
        )
        AND ($10 = '' OR b.customer_id = $10)
    `;
    const params = [
      accessMode,
      identity.id,
      search,
      pattern,
      query.status,
      query.building,
      query.dateFrom,
      query.dateTo,
      query.assignee,
      query.customerId,
    ];
    const [rows, count] = await Promise.all([
      this.db.query(
        `${BOOKING_SELECT} ${where}
         ORDER BY ${sortColumn} ${order}, b.id DESC
         LIMIT $11 OFFSET $12`,
        [...params, query.pageSize, pageOffset(query.page, query.pageSize)],
      ),
      this.db.query<{ count: number }>(
        `SELECT COUNT(DISTINCT b.id)::int AS count ${BOOKING_SELECT.slice(BOOKING_SELECT.indexOf('FROM bookings'))} ${where}`,
        params,
      ),
    ]);
    return pageResult(
      rows.rows.map((row) => accessMode === 'own' ? this.selfRecord(row) : mapBookingRow(row)),
      query.page,
      query.pageSize,
      Number(count.rows[0]?.count || 0),
    );
  }

  async detail(identity: AppIdentity, id: string) {
    const accessMode = this.accessMode(identity);
    const result = await this.db.query(
      `${BOOKING_SELECT}
       WHERE b.id = $1
         AND (
           $2 = 'all'
           OR ($2 = 'assigned' AND b.assigned_user_id = $3)
           OR ($2 = 'own' AND b.self_user_id = $3)
         )
       LIMIT 1`,
      [id, accessMode, identity.id],
    );
    if (!result.rows[0]) {
      throw new NotFoundException({ error: 'Không tìm thấy lịch hẹn.' });
    }
    return mapBookingRow(result.rows[0]);
  }

  async stats(identity: AppIdentity) {
    const accessMode = this.accessMode(identity);
    const result = await this.db.query<{ total: number; pending: number }>(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'Chờ xác nhận')::int AS pending
        FROM bookings
        WHERE (
          $1 = 'all'
          OR ($1 = 'assigned' AND assigned_user_id = $2)
          OR ($1 = 'own' AND self_user_id = $2)
        )
      `,
      [accessMode, identity.id],
    );
    return {
      total: Number(result.rows[0]?.total || 0),
      pending: Number(result.rows[0]?.pending || 0),
    };
  }

  async create(data: CreateBookingRequest, identity?: AppIdentity) {
    const referral = data.affiliateToken
      ? await this.affiliate.resolveToken(data.affiliateToken)
      : null;
    const appointmentAt = bookingAppointmentAt(
      data.appointmentDate,
      data.appointmentTime,
      data.appointmentTimezoneOffsetMinutes,
    );
    if (!appointmentAt) {
      throw new BadRequestException({ error: 'Thời gian hẹn không hợp lệ.' });
    }
    if (appointmentAt.getTime() < Date.now() + BOOKING_MIN_LEAD_MS) {
      throw new BadRequestException({
        error: 'Vui lòng đặt lịch hẹn trước ít nhất 1 giờ.',
      });
    }

    const id = `BK-${Date.now()}-${crypto.randomInt(100, 999)}`;
    const normalizedTime = normalizeBookingTime24h(data.appointmentTime)!;

    const sourceType = referral ? 'ctv' : 'website';
    const sourceChannel = referral ? 'Affiliate link' : 'Website';
    const sourceRecordedAt = new Date().toISOString();

    const booking = await this.db.transaction(async (client) => {
      // Validate and lock lifecycle before any Customer/Booking write. The lock prevents
      // Unit/Room/Building state from changing between FE05.2 eligibility check and INSERT.
      const unit = await this.requireBookingRoomUnit(data.roomUnitId, client);
      const eligibility = bookingRoomUnitEligibility({
        status: unit.status,
        availableFrom: unit.availableFrom,
        appointmentDate: data.appointmentDate,
        appointmentTime: data.appointmentTime,
        appointmentTimezoneOffsetMinutes: data.appointmentTimezoneOffsetMinutes,
      });
      if (!eligibility.allowed) {
        throw new BadRequestException({ error: eligibility.message });
      }

      const normalizedPhone = data.phone.replace(/\D/g, '');
      const customerCandidates = normalizedPhone
        ? await client.query(
          `SELECT id
           FROM customers
           WHERE archived_at IS NULL
             AND regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = $1
           ORDER BY created_at ASC
           LIMIT 2`,
          [normalizedPhone],
        )
        : { rows: [] as Array<{ id: string }> };

      let customerId = '';
      if (customerCandidates.rows.length === 1) {
        customerId = String(customerCandidates.rows[0].id);
        await client.query(
          `UPDATE customers
           SET name = CASE WHEN btrim(COALESCE(name, '')) = '' THEN $2 ELSE name END,
               email = CASE
                 WHEN btrim(COALESCE(email, '')) = '' AND $3 <> '' THEN $3
                 ELSE email
               END,
               source_type = CASE WHEN btrim(COALESCE(source_type, '')) = '' THEN $4 ELSE source_type END,
               source_channel = CASE WHEN btrim(COALESCE(source_channel, '')) = '' THEN $5 ELSE source_channel END,
               referred_by_collaborator_id = COALESCE(referred_by_collaborator_id, $6),
               source_recorded_at = COALESCE(source_recorded_at, $7::timestamptz),
               updated_at = NOW()
           WHERE id = $1`,
          [
            customerId,
            data.customerName,
            data.email || '',
            sourceType,
            sourceChannel,
            referral?.collaboratorId || null,
            sourceRecordedAt,
          ],
        );
      } else {
        customerId = `cust_${crypto.randomUUID()}`;
        await client.query(
          `INSERT INTO customers (
             id, name, phone, email, address, notes,
             source_type, source_channel, referred_by_collaborator_id, source_recorded_at,
             created_at, updated_at
           ) VALUES ($1,$2,$3,$4,'','',$5,$6,$7,$8::timestamptz,NOW(),NOW())`,
          [
            customerId,
            data.customerName,
            data.phone,
            data.email || '',
            sourceType,
            sourceChannel,
            referral?.collaboratorId || null,
            sourceRecordedAt,
          ],
        );
      }

      const result = await client.query(
        `INSERT INTO bookings (
           id, customer_name, phone, email, customer_id,
           room_unit_id, building_id, building_code, room_type_id, room_number,
           appointment_date, appointment_time,
           appointment_at, appointment_timezone_offset_minutes,
           status, notes,
           collaborator_id, source_type, source_channel, source_recorded_at,
           self_user_id, updated_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW()
         )
         RETURNING *`,
        [id, data.customerName, data.phone, data.email || '', customerId,
         unit.id, unit.buildingId, unit.buildingCode, unit.roomTypeId, unit.code,
         data.appointmentDate, normalizedTime, appointmentAt.toISOString(),
         data.appointmentTimezoneOffsetMinutes, 'Chờ xác nhận', data.notes || '',
         referral?.collaboratorId || null, sourceType, sourceChannel, sourceRecordedAt, identity?.id || null],
      );

      return mapBookingRow({
        ...result.rows[0],
        resolved_room_unit_id: unit.id,
        resolved_room_number: unit.code,
        resolved_room_type_id: unit.roomTypeId,
        building_name: unit.buildingName,
        room_type_name: unit.roomTypeName,
        collaborator_name: referral?.collaboratorName || '',
        assigned_user_name: '',
        assigned_user_email: '',
        deal_id: null,
      });
    });

    try {
      const buildingResult = await this.db.query(
        `
          SELECT *
          FROM buildings
          WHERE ($1 <> '' AND lower(code) = lower($1))
             OR ($2 <> '' AND id = $2)
          LIMIT 1
        `,
        [
          booking.buildingCode || '',
          booking.buildingId || '',
        ],
      );

      await this.email
        .sendBookingNotificationToAdmin({
          booking,
          building: buildingResult.rows[0] || null,
        })
        .catch((error: Error) =>
          console.warn(
            '[BookingsService] Email dispatch failed:',
            error.message,
          ),
        );
    } catch (error) {
      console.warn(
        '[BookingsService] Email preparation failed:',
        error instanceof Error ? error.message : error,
      );
    }

    return bookingPublicReceiptSchema.parse({
      id: booking.id,
      roomUnitId: booking.roomUnitId || data.roomUnitId,
      roomUnitCode: booking.roomNumber || '',
      buildingCode: booking.buildingCode || '',
      buildingName: booking.buildingName || '',
      roomTypeName: booking.roomTypeName || '',
      appointmentDate: booking.appointmentDate || data.appointmentDate,
      appointmentTime: booking.appointmentTime || normalizedTime,
      // pg returns timestamptz as Date; validate the wire representation before HTTP serialization.
      appointmentAt: new Date(booking.appointmentAt || appointmentAt).toISOString(),
      appointmentTimezoneOffsetMinutes:
        booking.appointmentTimezoneOffsetMinutes
        ?? data.appointmentTimezoneOffsetMinutes,
      status: booking.status,
    });
  }

  async createAdmin(data: CreateAdminBookingRequest, user: AppIdentity) {
    if (this.accessMode(user) !== 'all') {
      throw new ForbiddenException({ error: 'Bạn không có quyền tạo lịch xem cho khách hàng.' });
    }

    const customerResult = await this.db.query<{
      id: string;
      name: string;
      phone: string;
      email: string;
      source_type: string;
      source_channel: string;
      referred_by_collaborator_id: string | null;
      source_recorded_at: string | Date | null;
    }>(
      `SELECT id, name, phone, email, source_type, source_channel,
              referred_by_collaborator_id, source_recorded_at
       FROM customers
       WHERE id = $1 AND archived_at IS NULL
       LIMIT 1`,
      [data.customerId],
    );
    const customer = customerResult.rows[0];
    if (!customer) {
      throw new BadRequestException({ error: 'Không tìm thấy hồ sơ khách hàng đang hoạt động.' });
    }

    const appointmentAt = bookingAppointmentAt(
      data.appointmentDate,
      data.appointmentTime,
      data.appointmentTimezoneOffsetMinutes,
    );
    if (!appointmentAt) {
      throw new BadRequestException({ error: 'Thời gian hẹn không hợp lệ.' });
    }
    if (appointmentAt.getTime() < Date.now() + BOOKING_MIN_LEAD_MS) {
      throw new BadRequestException({
        error: 'Vui lòng đặt lịch hẹn trước ít nhất 1 giờ.',
      });
    }

    const unit = await this.requireBookingRoomUnit(data.roomUnitId);

    if (data.assignedUserId) {
      const assignee = await this.db.query<{ id: string }>(
        `SELECT u.id
         FROM users u
         JOIN roles r ON lower(r.code) = lower(u.role_code)
         WHERE u.id = $1
           AND lower(btrim(u.status)) IN ('hoạt động', 'active', 'approved', 'enabled')
           AND r.booking_scope IN ('all', 'assigned')
           AND (
             COALESCE(r.allowed_screens, '[]'::jsonb) ? 'bookings'
             OR COALESCE(r.allowed_screens, '[]'::jsonb) ? '*'
           )
         LIMIT 1`,
        [data.assignedUserId],
      );
      if (!assignee.rows[0]) {
        throw new BadRequestException({
          error: 'Người phụ trách phải là tài khoản đang hoạt động có quyền Lịch xem phòng.',
        });
      }
    }

    const id = `BK-${Date.now()}-${crypto.randomInt(100, 999)}`;
    const normalizedTime = normalizeBookingTime24h(data.appointmentTime)!;
    const sourceRecordedAt = customer.source_recorded_at
      ? new Date(customer.source_recorded_at).toISOString()
      : null;

    await this.db.transaction(async (client) => {
      const unit = await this.requireBookingRoomUnit(data.roomUnitId, client);
      await client.query(
      `INSERT INTO bookings (
         id, customer_name, phone, email, customer_id,
         room_unit_id, building_id, building_code, room_type_id, room_number,
         appointment_date, appointment_time, appointment_at,
         appointment_timezone_offset_minutes, status, assigned_user_id, notes,
         collaborator_id, source_type, source_channel, source_recorded_at,
         updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
         'Chờ xác nhận',$15,$16,$17,$18,$19,$20,NOW()
       )`,
      [id, customer.name || '', customer.phone || '', customer.email || '', customer.id,
       unit.id, unit.buildingId, unit.buildingCode, unit.roomTypeId, unit.code,
       data.appointmentDate, normalizedTime, appointmentAt.toISOString(),
       data.appointmentTimezoneOffsetMinutes, data.assignedUserId || null, data.notes || '',
       customer.referred_by_collaborator_id || null, customer.source_type || '',
       customer.source_channel || '', sourceRecordedAt],
    );
    });

    await this.audit.create({
      user,
      action: 'CREATE',
      entityType: 'booking',
      entityId: id,
      summary: `${user.name || 'Admin'} đã tạo lịch xem ${id} cho ${customer.name || customer.id}`,
      metadata: {
        mode: 'admin_customer',
        customerId: customer.id,
        roomUnitId: unit.id,
        assignedUserId: data.assignedUserId || null,
        appointmentAt: appointmentAt.toISOString(),
      },
    }).catch(() => undefined);

    return this.detail(user, id);
  }

  async assignees(identity: AppIdentity, query: BookingAssigneeListQuery) {
    if (identity.bookingScope !== 'all' && !identity.bookingCanAssign && !identity.bookingCanReassign) {
      throw new ForbiddenException({ error: 'Bạn không có quyền xem danh sách người phụ trách.' });
    }
    const search = query.search.trim();
    const pattern = escapedLike(search);
    const result = await this.db.query<{
      id: string; name: string; email: string; role_code: string; role_name: string;
      booking_scope: 'all' | 'assigned';
    }>(
      `
        SELECT u.id, u.name, u.email, u.role_code,
               COALESCE(r.name, u.role_name, u.role_code) AS role_name,
               r.booking_scope
        FROM users u
        JOIN roles r ON lower(r.code) = lower(u.role_code)
        WHERE lower(btrim(u.status)) IN ('hoạt động', 'active', 'approved', 'enabled')
          AND r.booking_scope IN ('all', 'assigned')
          AND (COALESCE(r.allowed_screens, '[]'::jsonb) ? 'bookings' OR COALESCE(r.allowed_screens, '[]'::jsonb) ? '*')
          AND ($1 = '' OR u.name ILIKE $2 OR u.email ILIKE $2 OR COALESCE(r.name, '') ILIKE $2)
        ORDER BY lower(u.name), lower(u.email), u.id
        LIMIT 100
      `,
      [search, pattern],
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name || '',
      email: row.email || '',
      roleCode: row.role_code || '',
      roleName: row.role_name || '',
      bookingScope: row.booking_scope,
    }));
  }

  async updateAssignment(
    id: string,
    assignedUserId: string | null,
    user: AppIdentity,
  ) {
    const currentResult = await this.db.query<{
      id: string;
      assigned_user_id: string | null;
    }>(
      'SELECT id, assigned_user_id FROM bookings WHERE id = $1 LIMIT 1',
      [id],
    );
    const current = currentResult.rows[0];
    if (!current) {
      throw new NotFoundException({ error: 'Không tìm thấy lịch hẹn.' });
    }

    const changingAssignment = (current.assigned_user_id || null) !== assignedUserId;
    if (changingAssignment) {
      const required = current.assigned_user_id ? user.bookingCanReassign : user.bookingCanAssign;
      if (!required) {
        throw new ForbiddenException({
          error: current.assigned_user_id
            ? 'Bạn không có quyền giao lại hoặc gỡ người phụ trách.'
            : 'Bạn không có quyền phân công lịch xem.',
        });
      }
    }

    let assigneeName = '';
    if (assignedUserId) {
      const assigneeResult = await this.db.query<{
        id: string;
        name: string;
      }>(
        `
          SELECT u.id, u.name
          FROM users u
          JOIN roles r ON lower(r.code) = lower(u.role_code)
          WHERE u.id = $1
            AND lower(btrim(u.status)) IN ('hoạt động', 'active', 'approved', 'enabled')
            AND r.booking_scope IN ('all', 'assigned')
            AND (
              COALESCE(r.allowed_screens, '[]'::jsonb) ? 'bookings'
              OR COALESCE(r.allowed_screens, '[]'::jsonb) ? '*'
            )
          LIMIT 1
        `,
        [assignedUserId],
      );
      const assignee = assigneeResult.rows[0];
      if (!assignee) {
        throw new BadRequestException({
          error: 'Người phụ trách phải là tài khoản đang hoạt động có quyền Lịch xem phòng.',
        });
      }
      assigneeName = assignee.name;
    }

    if (changingAssignment) {
      await this.db.query(
        `UPDATE bookings
         SET assigned_user_id = $2, updated_at = NOW()
         WHERE id = $1`,
        [id, assignedUserId],
      );

      await this.audit.create({
        user,
        action: 'UPDATE',
        entityType: 'booking',
        entityId: id,
        summary: assignedUserId
          ? `${user.name || 'Admin'} đã phân công lịch hẹn ${id} cho ${assigneeName || assignedUserId}`
          : `${user.name || 'Admin'} đã gỡ phân công lịch hẹn ${id}`,
        metadata: {
          previousAssignedUserId: current.assigned_user_id,
          assignedUserId,
        },
      }).catch(() => undefined);
    }

    return this.detail(user, id);
  }

  async reschedule(
    id: string,
    data: BookingRescheduleRequest,
    user: AppIdentity,
  ) {
    const current = await this.detail(user, id);
    const currentStatus = bookingStatusSchema.parse(current.status);
    if (!user.bookingCanReschedule) {
      throw new ForbiddenException({ error: 'Bạn không có quyền đổi lịch xem.' });
    }
    if (!bookingCanRescheduleStatus(currentStatus)) {
      throw new BadRequestException({
        error: `Không thể đổi lịch khi trạng thái là “${currentStatus}”.`,
      });
    }

    const appointmentAt = bookingAppointmentAt(
      data.appointmentDate,
      data.appointmentTime,
      data.appointmentTimezoneOffsetMinutes,
    );
    if (!appointmentAt) {
      throw new BadRequestException({ error: 'Thời gian hẹn mới không hợp lệ.' });
    }
    if (appointmentAt.getTime() < Date.now() + BOOKING_MIN_LEAD_MS) {
      throw new BadRequestException({
        error: 'Vui lòng đổi lịch sang thời gian cách hiện tại ít nhất 1 giờ.',
      });
    }
    if (!current.updatedAt) {
      throw new ConflictException({
        error: 'Lịch thiếu mốc cập nhật để đổi lịch an toàn. Vui lòng mở lại chi tiết.',
      });
    }

    const normalizedTime = normalizeBookingTime24h(data.appointmentTime)!;
    const result = await this.db.query(
      `
        UPDATE bookings
        SET appointment_date = $2::date,
            appointment_time = $3,
            appointment_at = $4::timestamptz,
            appointment_timezone_offset_minutes = $5,
            status = 'Chờ xác nhận',
            updated_at = NOW()
        WHERE id = $1
          AND status = $6
          AND date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', $7::timestamptz)
        RETURNING id
      `,
      [
        id,
        data.appointmentDate,
        normalizedTime,
        appointmentAt.toISOString(),
        data.appointmentTimezoneOffsetMinutes,
        currentStatus,
        current.updatedAt,
      ],
    );
    if (!result.rows[0]) {
      throw new ConflictException({
        error: 'Lịch vừa được thay đổi bởi thao tác khác. Vui lòng mở lại chi tiết và thử lại.',
      });
    }

    await this.audit.create({
      user,
      action: 'UPDATE',
      entityType: 'booking',
      entityId: id,
      summary: `${user.name || 'Admin'} đã đổi lịch hẹn ${id} sang ${data.appointmentDate} ${normalizedTime}`,
      metadata: {
        action: 'reschedule',
        previousAppointmentDate: current.appointmentDate,
        previousAppointmentTime: current.appointmentTime,
        previousAppointmentAt: current.appointmentAt,
        previousAppointmentTimezoneOffsetMinutes: current.appointmentTimezoneOffsetMinutes,
        appointmentDate: data.appointmentDate,
        appointmentTime: normalizedTime,
        appointmentAt: appointmentAt.toISOString(),
        appointmentTimezoneOffsetMinutes: data.appointmentTimezoneOffsetMinutes,
        previousStatus: currentStatus,
        status: 'Chờ xác nhận',
      },
    }).catch(() => undefined);

    return this.detail(user, id);
  }

  async transition(
    id: string,
    transition: BookingTransition,
    user: AppIdentity,
  ) {
    const current = await this.detail(user, id);
    const currentStatus = bookingStatusSchema.parse(current.status);
    const targetStatus = bookingTransitionTarget(currentStatus, transition);
    if (!targetStatus) {
      throw new BadRequestException({
        error: `Không thể chuyển lịch từ “${currentStatus}” bằng thao tác đã chọn.`,
      });
    }

    const isCancel = transition === 'cancel';
    if (isCancel ? !user.bookingCanCancel : !user.bookingCanTransition) {
      throw new ForbiddenException({
        error: isCancel
          ? 'Bạn không có quyền hủy lịch xem.'
          : 'Bạn không có quyền cập nhật tiến trình lịch xem.',
      });
    }

    const result = await this.db.query(
      `
        UPDATE bookings
        SET status = $2,
            updated_at = NOW()
        WHERE id = $1
          AND status = $3
        RETURNING id
      `,
      [id, targetStatus, currentStatus],
    );
    if (!result.rows[0]) {
      throw new ConflictException({
        error: 'Lịch vừa được thay đổi bởi thao tác khác. Vui lòng mở lại chi tiết và thử lại.',
      });
    }

    await this.audit.create({
      user,
      action: 'UPDATE',
      entityType: 'booking',
      entityId: id,
      summary: `${user.name || 'Admin'} đã chuyển lịch hẹn ${id} từ ${currentStatus} sang ${targetStatus}`,
      metadata: {
        transition,
        previousStatus: currentStatus,
        status: targetStatus,
      },
    }).catch(() => undefined);

    return this.detail(user, id);
  }

}
