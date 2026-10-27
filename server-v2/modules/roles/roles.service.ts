import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CMS_ROLE_SCREENS,
  ROLE_RESERVED_CODES,
  ROLE_SYSTEM_CODES,
  type RoleListQuery,
  type RoleSummary,
  type RoleWrite,
} from '@tinyhouse/contracts';
import crypto from 'crypto';
import type { PoolClient, QueryResultRow } from 'pg';
import type { AppIdentity } from '../../common/auth/auth.types.js';
import { PostgresService } from '../../database/postgres.service.js';
import { escapedLike, pageOffset, pageResult } from '../../common/list/list-utils.js';

type RoleRow = QueryResultRow & {
  id: string;
  name: string;
  code: string;
  description: string | null;
  allowed_screens: unknown;
  booking_scope: 'none' | 'all' | 'assigned';
  booking_can_assign: boolean;
  booking_can_reassign: boolean;
  booking_can_transition: boolean;
  booking_can_cancel: boolean;
  booking_can_reschedule: boolean;
  deal_scope: 'none' | 'all' | 'assigned';
  deal_can_create: boolean;
  deal_can_create_direct: boolean;
  deal_can_manage_contract_deposit: boolean;
  deal_can_manage_rental_schedule: boolean;
  deal_can_manage_lifecycle: boolean;
  created_at: string | Date;
  updated_at: string | Date;
};

const ROLE_COLUMNS = 'id, name, code, description, allowed_screens, booking_scope, booking_can_assign, booking_can_reassign, booking_can_transition, booking_can_cancel, booking_can_reschedule, deal_scope, deal_can_create, deal_can_create_direct, deal_can_manage_contract_deposit, deal_can_manage_rental_schedule, deal_can_manage_lifecycle, created_at, updated_at';
const SYSTEM_CODES = new Set<string>(ROLE_SYSTEM_CODES);
const RESERVED_CODES = new Set<string>(ROLE_RESERVED_CODES);
const SUPPORTED_SCREENS = new Set<string>(CMS_ROLE_SCREENS.map((screen) => screen.code));
const ACTIVE_STATUSES = new Set(['hoạt động', 'active', 'approved', 'enabled']);

function screens(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.map(String))] : [];
}

function equalScreens(left: string[], right: string[]) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function mapRole(row: RoleRow): RoleSummary {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description || '',
    // System administrators always have all screens and booking authority in AuthIdentityService.
    allowedScreens: SYSTEM_CODES.has(row.code) ? ['*'] : screens(row.allowed_screens),
    bookingScope: SYSTEM_CODES.has(row.code) ? 'all' : row.booking_scope || 'none',
    bookingCanAssign: SYSTEM_CODES.has(row.code) ? true : Boolean(row.booking_can_assign),
    bookingCanReassign: SYSTEM_CODES.has(row.code) ? true : Boolean(row.booking_can_reassign),
    bookingCanTransition: SYSTEM_CODES.has(row.code) ? true : Boolean(row.booking_can_transition),
    bookingCanCancel: SYSTEM_CODES.has(row.code) ? true : Boolean(row.booking_can_cancel),
    bookingCanReschedule: SYSTEM_CODES.has(row.code) ? true : Boolean(row.booking_can_reschedule),
    dealScope: SYSTEM_CODES.has(row.code) ? 'all' : row.deal_scope || 'none',
    dealCanCreate: SYSTEM_CODES.has(row.code) ? true : Boolean(row.deal_can_create),
    dealCanCreateDirect: SYSTEM_CODES.has(row.code) ? true : Boolean(row.deal_can_create_direct),
    dealCanManageContractDeposit: SYSTEM_CODES.has(row.code) ? true : Boolean(row.deal_can_manage_contract_deposit),
    dealCanManageRentalSchedule: SYSTEM_CODES.has(row.code) ? true : Boolean(row.deal_can_manage_rental_schedule),
    dealCanManageLifecycle: SYSTEM_CODES.has(row.code) ? true : Boolean(row.deal_can_manage_lifecycle),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

function duplicateCode(): never {
  throw new ConflictException({
    success: false,
    error: 'Mã vai trò đã tồn tại.',
    details: [{ path: 'code', message: 'Mã vai trò đã tồn tại.' }],
  });
}

@Injectable()
export class RolesService {
  constructor(private readonly db: PostgresService) {}

  async list(query: RoleListQuery) {
    const search = query.search.trim();
    const pattern = escapedLike(search);
    const sortColumn = {
      createdAt: 'r.created_at',
      name: 'lower(r.name)',
      code: 'lower(r.code)',
      userCount: 'user_count',
    }[query.sort] || 'r.created_at';
    const order = query.order === 'desc' ? 'DESC' : 'ASC';
    const where = `WHERE ($1 = '' OR r.name ILIKE $2 OR r.code ILIKE $2 OR COALESCE(r.description, '') ILIKE $2)`;
    const [rows, count] = await Promise.all([
      this.db.query<RoleRow & { user_count: number }>(
        `SELECT r.id, r.name, r.code, r.description, r.allowed_screens,
                r.booking_scope, r.booking_can_assign, r.booking_can_reassign,
                r.booking_can_transition, r.booking_can_cancel, r.booking_can_reschedule,
                r.deal_scope, r.deal_can_create, r.deal_can_create_direct, r.deal_can_manage_contract_deposit,
                r.deal_can_manage_rental_schedule, r.deal_can_manage_lifecycle,
                r.created_at, r.updated_at, COUNT(u.id)::int AS user_count
         FROM roles r
         LEFT JOIN users u ON u.role_code = r.code
         ${where}
         GROUP BY r.id
         ORDER BY ${sortColumn} ${order}, r.id ASC
         LIMIT $3 OFFSET $4`,
        [search, pattern, query.pageSize, pageOffset(query.page, query.pageSize)],
      ),
      this.db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM roles r ${where}`,
        [search, pattern],
      ),
    ]);
    return pageResult(
      rows.rows.map((row) => ({ ...mapRole(row), userCount: Number(row.user_count || 0) })),
      query.page,
      query.pageSize,
      Number(count.rows[0]?.count || 0),
    );
  }

  async detail(idOrCode: string): Promise<RoleSummary> {
    const result = await this.db.query<RoleRow>(
      `SELECT ${ROLE_COLUMNS} FROM roles WHERE id = $1 OR code = $1 LIMIT 1`,
      [idOrCode],
    );
    if (!result.rows[0]) {
      throw new NotFoundException({ success: false, error: 'Không tìm thấy vai trò.' });
    }
    return mapRole(result.rows[0]);
  }

  private async adminWrite<T>(actor: AppIdentity, operation: (client: PoolClient) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction(async (client) => {
        // Coordinate with UsersService so assignments and role deletion cannot race.
        await client.query('SELECT pg_advisory_xact_lock(74120, 1)');
        const result = await client.query<{ role_code: string | null; status: string }>(
          'SELECT role_code, status FROM users WHERE id = $1',
          [actor.id],
        );
        const current = result.rows[0];
        if (!current || !SYSTEM_CODES.has(current.role_code || '') || !ACTIVE_STATUSES.has(current.status.trim().toLowerCase())) {
          throw new ForbiddenException({ success: false, error: 'Quyền quản trị đã thay đổi. Vui lòng đăng nhập lại.' });
        }
        return operation(client);
      });
    } catch (error) {
      const databaseError = error as { code?: string; constraint?: string };
      if (databaseError.code === '23505' && databaseError.constraint?.includes('code')) duplicateCode();
      throw error;
    }
  }

  private async existingRole(client: PoolClient, id: string) {
    const result = await client.query<RoleRow>(
      `SELECT ${ROLE_COLUMNS} FROM roles WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!result.rows[0]) {
      throw new NotFoundException({ success: false, error: 'Không tìm thấy vai trò.' });
    }
    return result.rows[0];
  }

  private fixedAuthority(code: string) {
    if (code === 'ctv_sale' || code === 'customer') {
      return {
        allowedScreens: [] as string[],
        bookingScope: 'none' as const,
        bookingCanAssign: false,
        bookingCanReassign: false,
        bookingCanTransition: false,
        bookingCanCancel: false,
        bookingCanReschedule: false,
        dealScope: 'none' as const,
        dealCanCreate: false,
        dealCanCreateDirect: false,
        dealCanManageContractDeposit: false,
        dealCanManageRentalSchedule: false,
        dealCanManageLifecycle: false,
      };
    }
    if (code === 'commission_accountant') {
      return {
        allowedScreens: ['commissionHistory'],
        bookingScope: 'none' as const,
        bookingCanAssign: false,
        bookingCanReassign: false,
        bookingCanTransition: false,
        bookingCanCancel: false,
        bookingCanReschedule: false,
        dealScope: 'none' as const,
        dealCanCreate: false,
        dealCanCreateDirect: false,
        dealCanManageContractDeposit: false,
        dealCanManageRentalSchedule: false,
        dealCanManageLifecycle: false,
      };
    }
    return null;
  }

  private validatedScreens(code: string, requested: string[]) {
    const requestedScreens = screens(requested);
    const fixed = this.fixedAuthority(code);
    if (fixed) {
      if (!equalScreens(requestedScreens, fixed.allowedScreens)) {
        throw new ForbiddenException({
          success: false,
          error: 'Quyền nghiệp vụ của vai trò này được hệ thống cố định.',
          details: [{ path: 'allowedScreens', message: 'Không thể thay đổi quyền của vai trò hệ thống này.' }],
        });
      }
      return fixed.allowedScreens;
    }
    if (SYSTEM_CODES.has(code)) {
      if (!equalScreens(requestedScreens, ['*'])) {
        throw new ForbiddenException({
          success: false,
          error: 'Vai trò quản trị hệ thống luôn có toàn quyền; không thể thay đổi quyền truy cập.',
        });
      }
      return ['*'];
    }
    const unsupported = requestedScreens.filter((screen) => !SUPPORTED_SCREENS.has(screen));
    if (unsupported.length) {
      throw new BadRequestException({
        success: false,
        error: 'Vai trò này chỉ được cấp các màn hình nghiệp vụ được hỗ trợ.',
        details: [{ path: 'allowedScreens', message: 'Không được cấp quyền quản trị hệ thống hoặc màn hình không tồn tại.' }],
      });
    }
    // A legacy role may contain unsupported grants. A supported subset removes
    // those grants explicitly; an empty selection stays empty.
    return requestedScreens;
  }

  private async audit(client: PoolClient, actor: AppIdentity, id: string, action: string, summary: string) {
    await client.query(
      `INSERT INTO audit_logs (
        id, user_id, user_name, user_email, action, entity_type, entity_id, summary
       ) VALUES ($1,$2,$3,$4,$5,'role',$6,$7)`,
      [`LOG-${crypto.randomUUID()}`, actor.id, actor.name, actor.email, action, id, summary],
    );
  }

  async save(data: RoleWrite, actor: AppIdentity): Promise<RoleSummary> {
    return this.adminWrite(actor, async (client) => {
      const current = data.id ? await this.existingRole(client, data.id) : undefined;
      if (current && current.code !== data.code) {
        throw new BadRequestException({
          success: false,
          error: 'Không thể thay đổi mã vai trò đã tạo.',
          details: [{ path: 'code', message: 'Mã vai trò không thể thay đổi.' }],
        });
      }
      if (!current && RESERVED_CODES.has(data.code)) {
        throw new ForbiddenException({
          success: false,
          error: 'Mã vai trò này dành riêng cho hệ thống.',
          details: [{ path: 'code', message: 'Mã vai trò dành riêng cho hệ thống.' }],
        });
      }
      const fixedAuthority = this.fixedAuthority(data.code);
      if (fixedAuthority && (
        data.bookingScope !== fixedAuthority.bookingScope
        || data.bookingCanAssign !== fixedAuthority.bookingCanAssign
        || data.bookingCanReassign !== fixedAuthority.bookingCanReassign
        || data.bookingCanTransition !== fixedAuthority.bookingCanTransition
        || data.bookingCanCancel !== fixedAuthority.bookingCanCancel
        || data.bookingCanReschedule !== fixedAuthority.bookingCanReschedule
        || data.dealScope !== fixedAuthority.dealScope
        || data.dealCanCreate !== fixedAuthority.dealCanCreate
        || data.dealCanCreateDirect !== fixedAuthority.dealCanCreateDirect
        || data.dealCanManageContractDeposit !== fixedAuthority.dealCanManageContractDeposit
        || data.dealCanManageRentalSchedule !== fixedAuthority.dealCanManageRentalSchedule
        || data.dealCanManageLifecycle !== fixedAuthority.dealCanManageLifecycle
      )) {
        throw new ForbiddenException({
          success: false,
          error: 'Quyền nghiệp vụ của vai trò này được hệ thống cố định.',
        });
      }
      const allowedScreens = this.validatedScreens(data.code, data.allowedScreens);
      const bookingScope = SYSTEM_CODES.has(data.code) ? 'all' : fixedAuthority?.bookingScope ?? data.bookingScope;
      const bookingCanAssign = SYSTEM_CODES.has(data.code) ? true : fixedAuthority?.bookingCanAssign ?? data.bookingCanAssign;
      const bookingCanReassign = SYSTEM_CODES.has(data.code) ? true : fixedAuthority?.bookingCanReassign ?? data.bookingCanReassign;
      const bookingCanTransition = SYSTEM_CODES.has(data.code) ? true : fixedAuthority?.bookingCanTransition ?? data.bookingCanTransition;
      const bookingCanCancel = SYSTEM_CODES.has(data.code) ? true : fixedAuthority?.bookingCanCancel ?? data.bookingCanCancel;
      const bookingCanReschedule = SYSTEM_CODES.has(data.code) ? true : fixedAuthority?.bookingCanReschedule ?? data.bookingCanReschedule;
      const dealScope = SYSTEM_CODES.has(data.code) ? 'all' : fixedAuthority?.dealScope ?? data.dealScope;
      const dealCanCreate = SYSTEM_CODES.has(data.code) ? true : fixedAuthority?.dealCanCreate ?? data.dealCanCreate;
      const dealCanCreateDirect = SYSTEM_CODES.has(data.code) ? true : fixedAuthority?.dealCanCreateDirect ?? data.dealCanCreateDirect;
      const dealCanManageContractDeposit = SYSTEM_CODES.has(data.code) ? true : fixedAuthority?.dealCanManageContractDeposit ?? data.dealCanManageContractDeposit;
      const dealCanManageRentalSchedule = SYSTEM_CODES.has(data.code) ? true : fixedAuthority?.dealCanManageRentalSchedule ?? data.dealCanManageRentalSchedule;
      const dealCanManageLifecycle = SYSTEM_CODES.has(data.code) ? true : fixedAuthority?.dealCanManageLifecycle ?? data.dealCanManageLifecycle;
      if (!current) {
        const duplicate = await client.query('SELECT id FROM roles WHERE code = $1 LIMIT 1', [data.code]);
        if (duplicate.rowCount) duplicateCode();
      }

      const id = current?.id ?? `role_${crypto.randomUUID()}`;
      const result = current
        ? await client.query<RoleRow>(
          `UPDATE roles SET name = $2, description = $3, allowed_screens = $4::jsonb,
             booking_scope = $5, booking_can_assign = $6, booking_can_reassign = $7,
             booking_can_transition = $8, booking_can_cancel = $9, booking_can_reschedule = $10,
             deal_scope = $11, deal_can_create = $12, deal_can_create_direct = $13,
             deal_can_manage_contract_deposit = $14,
             deal_can_manage_rental_schedule = $15,
             deal_can_manage_lifecycle = $16,
             updated_at = NOW()
           WHERE id = $1 RETURNING ${ROLE_COLUMNS}`,
          [id, data.name, data.description ?? '', JSON.stringify(allowedScreens), bookingScope, bookingCanAssign, bookingCanReassign, bookingCanTransition, bookingCanCancel, bookingCanReschedule, dealScope, dealCanCreate, dealCanCreateDirect, dealCanManageContractDeposit, dealCanManageRentalSchedule, dealCanManageLifecycle],
        )
        : await client.query<RoleRow>(
          `INSERT INTO roles (
             id, name, code, description, allowed_screens,
             booking_scope, booking_can_assign, booking_can_reassign,
             booking_can_transition, booking_can_cancel, booking_can_reschedule,
             deal_scope, deal_can_create, deal_can_create_direct, deal_can_manage_contract_deposit, deal_can_manage_rental_schedule, deal_can_manage_lifecycle
           ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING ${ROLE_COLUMNS}`,
          [id, data.name, data.code, data.description ?? '', JSON.stringify(allowedScreens), bookingScope, bookingCanAssign, bookingCanReassign, bookingCanTransition, bookingCanCancel, bookingCanReschedule, dealScope, dealCanCreate, dealCanCreateDirect, dealCanManageContractDeposit, dealCanManageRentalSchedule, dealCanManageLifecycle],
        );

      if (current && current.name !== data.name) {
        await client.query('UPDATE users SET role_name = $2, updated_at = NOW() WHERE role_code = $1', [data.code, data.name]);
      }
      const authorityChanged = Boolean(current && !SYSTEM_CODES.has(current.code) && (
        !equalScreens(screens(current.allowed_screens), allowedScreens)
        || current.booking_scope !== bookingScope
        || Boolean(current.booking_can_assign) !== bookingCanAssign
        || Boolean(current.booking_can_reassign) !== bookingCanReassign
        || Boolean(current.booking_can_transition) !== bookingCanTransition
        || Boolean(current.booking_can_cancel) !== bookingCanCancel
        || Boolean(current.booking_can_reschedule) !== bookingCanReschedule
        || current.deal_scope !== dealScope
        || Boolean(current.deal_can_create) !== dealCanCreate
        || Boolean(current.deal_can_create_direct) !== dealCanCreateDirect
        || Boolean(current.deal_can_manage_contract_deposit) !== dealCanManageContractDeposit
        || Boolean(current.deal_can_manage_rental_schedule) !== dealCanManageRentalSchedule
        || Boolean(current.deal_can_manage_lifecycle) !== dealCanManageLifecycle
      ));
      if (authorityChanged) {
        await client.query(
          `UPDATE refresh_tokens SET revoked_at = NOW()
           WHERE revoked_at IS NULL AND user_id IN (SELECT id FROM users WHERE role_code = $1)`,
          [data.code],
        );
      }
      await this.audit(client, actor, id, current ? 'UPDATE' : 'CREATE', current ? 'Cập nhật vai trò và quyền truy cập.' : 'Tạo vai trò.');
      return mapRole(result.rows[0]);
    });
  }

  async update(id: string, data: RoleWrite, actor: AppIdentity) {
    if (data.id && data.id !== id) {
      throw new BadRequestException({ success: false, error: 'ID vai trò trong đường dẫn và dữ liệu không khớp.' });
    }
    return this.save({ ...data, id }, actor);
  }

  async remove(id: string, actor: AppIdentity) {
    return this.adminWrite(actor, async (client) => {
      const role = await this.existingRole(client, id);
      if (SYSTEM_CODES.has(role.code)) {
        throw new ForbiddenException({ success: false, error: 'Không thể xóa vai trò quản trị hệ thống.' });
      }
      if (role.code === 'ctv_sale' || role.code === 'customer') {
        throw new ForbiddenException({ success: false, error: 'Vai trò này đang được dùng cho luồng đăng ký tài khoản.' });
      }
      const users = await client.query<{ count: number }>(
        'SELECT COUNT(*)::int AS count FROM users WHERE role_code = $1',
        [role.code],
      );
      if (Number(users.rows[0]?.count || 0) > 0) {
        throw new ConflictException({ success: false, error: 'Không thể xóa vai trò đang được gán cho người dùng.' });
      }
      await client.query('DELETE FROM roles WHERE id = $1', [role.id]);
      await this.audit(client, actor, role.id, 'DELETE', 'Xóa vai trò.');
      return { success: true as const, id: role.id };
    });
  }
}
