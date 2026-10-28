import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CMS_ROLE_SCREENS, isCombinableRoleCode } from '@tinyhouse/contracts';
import type { PoolClient, QueryResultRow } from 'pg';
import { PostgresService } from '../../database/postgres.service.js';
import type {
  AccessTokenPayload,
  AppIdentity,
} from './auth.types.js';

const ACTIVE_STATUSES = new Set([
  'hoạt động',
  'active',
  'approved',
  'enabled',
]);

type IdentityRow = QueryResultRow & {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role_code: string | null;
  role_name: string | null;
  extra_role_codes: unknown;
  status: string;
  avatar: string | null;
  allowed_screens: unknown;
  booking_scope: 'none' | 'all' | 'assigned' | null;
  booking_can_assign: boolean | null;
  booking_can_reassign: boolean | null;
  booking_can_transition: boolean | null;
  booking_can_cancel: boolean | null;
  booking_can_reschedule: boolean | null;
  deal_scope: 'none' | 'all' | 'assigned' | null;
  deal_can_create: boolean | null;
  deal_can_create_direct: boolean | null;
  deal_can_manage_contract_deposit: boolean | null;
  deal_can_manage_rental_schedule: boolean | null;
  deal_can_manage_lifecycle: boolean | null;
};

const ROLE_AUTHORITY_COLUMNS = `
  COALESCE(r.allowed_screens, '[]'::jsonb) AS allowed_screens,
  COALESCE(r.booking_scope, 'none') AS booking_scope,
  COALESCE(r.booking_can_assign, FALSE) AS booking_can_assign,
  COALESCE(r.booking_can_reassign, FALSE) AS booking_can_reassign,
  COALESCE(r.booking_can_transition, FALSE) AS booking_can_transition,
  COALESCE(r.booking_can_cancel, FALSE) AS booking_can_cancel,
  COALESCE(r.booking_can_reschedule, FALSE) AS booking_can_reschedule,
  COALESCE(r.deal_scope, 'none') AS deal_scope,
  COALESCE(r.deal_can_create, FALSE) AS deal_can_create,
  COALESCE(r.deal_can_create_direct, FALSE) AS deal_can_create_direct,
  COALESCE(r.deal_can_manage_contract_deposit, FALSE) AS deal_can_manage_contract_deposit,
  COALESCE(r.deal_can_manage_rental_schedule, FALSE) AS deal_can_manage_rental_schedule,
  COALESCE(r.deal_can_manage_lifecycle, FALSE) AS deal_can_manage_lifecycle
`;
const AUTHORITY_FLAGS = [
  'booking_can_assign', 'booking_can_reassign', 'booking_can_transition', 'booking_can_cancel', 'booking_can_reschedule',
  'deal_can_create', 'deal_can_create_direct', 'deal_can_manage_contract_deposit', 'deal_can_manage_rental_schedule', 'deal_can_manage_lifecycle',
] as const;
const SCOPE_RANK = { none: 0, assigned: 1, all: 2 } as const;

/** An account with extra roles gets the union of screens, the widest scopes and every granted flag. */
function mergeRoleAuthority(target: QueryResultRow, roles: QueryResultRow[]) {
  for (const role of roles) {
    const screens = new Set([
      ...(Array.isArray(target.allowed_screens) ? target.allowed_screens : []),
      ...(Array.isArray(role.allowed_screens) ? role.allowed_screens : []),
    ]);
    target.allowed_screens = [...screens];
    for (const scope of ['booking_scope', 'deal_scope'] as const) {
      const current = (target[scope] || 'none') as keyof typeof SCOPE_RANK;
      const next = (role[scope] || 'none') as keyof typeof SCOPE_RANK;
      if ((SCOPE_RANK[next] ?? 0) > (SCOPE_RANK[current] ?? 0)) target[scope] = next;
    }
    for (const flag of AUTHORITY_FLAGS) target[flag] = Boolean(target[flag]) || Boolean(role[flag]);
  }
}

function normalizeStatus(status: unknown) {
  return String(status || '').trim().toLowerCase();
}

function bearerToken(value: unknown) {
  return String(value || '')
    .replace(/^Bearer\s+/i, '')
    .trim();
}

@Injectable()
export class AuthIdentityService {
  constructor(
    private readonly db: PostgresService,
    private readonly jwt: JwtService,
  ) {}

  async identityByUserId(
    userId: string,
    authMode: 'postgres' = 'postgres',
    client?: PoolClient,
  ): Promise<AppIdentity | null> {
    const query = (sql: string, params: unknown[]) => client
      ? client.query<IdentityRow>(sql, params) : this.db.query<IdentityRow>(sql, params);
    const result = await query(
      `
        SELECT
          u.id,
          u.name,
          u.email,
          u.phone,
          u.role_code,
          COALESCE(r.name, u.role_name) AS role_name,
          u.extra_role_codes,
          u.status,
          u.avatar,
          ${ROLE_AUTHORITY_COLUMNS}
        FROM users u
        LEFT JOIN roles r ON r.code = u.role_code
        WHERE u.id = $1
        LIMIT 1
      `,
      [userId],
    );

    const row = result.rows[0];
    if (!row) return null;

    const roleCode = String(row.role_code || 'unassigned');
    const extraCodes = isCombinableRoleCode(roleCode) && Array.isArray(row.extra_role_codes)
      ? row.extra_role_codes.map(String).filter(isCombinableRoleCode) : [];
    const extraRoles = extraCodes.length ? (await query(
      `SELECT ${ROLE_AUTHORITY_COLUMNS} FROM roles r WHERE r.code = ANY($1::text[])`, [extraCodes],
    )).rows : [];
    mergeRoleAuthority(row, extraRoles);
    if (roleCode === 'customer') {
      row.allowed_screens = [];
      row.booking_scope = 'none';
      row.deal_scope = 'none';
      row.booking_can_assign = row.booking_can_reassign = row.booking_can_transition = false;
      row.booking_can_cancel = row.booking_can_reschedule = false;
      row.deal_can_create = row.deal_can_create_direct = row.deal_can_manage_contract_deposit = false;
      row.deal_can_manage_rental_schedule = row.deal_can_manage_lifecycle = false;
    }
    const systemAdmin = roleCode === 'admin' || roleCode === 'superadmin';
    const allowedScreens =
      systemAdmin
        ? ['*']
        : Array.isArray(row.allowed_screens)
          ? CMS_ROLE_SCREENS.filter((screen) =>
              (row.allowed_screens as unknown[]).includes('*') ||
              (row.allowed_screens as unknown[]).includes(screen.code),
            ).map((screen) => screen.code)
          : [];

    return {
      id: row.id,
      name: row.name,
      email: String(row.email || '').trim().toLowerCase(),
      phone: row.phone || '',
      roleCode,
      roleCodes: [roleCode, ...extraCodes],
      roleName: row.role_name || roleCode,
      status: row.status || 'Chờ duyệt',
      avatar: row.avatar || '',
      allowedScreens,
      bookingScope: systemAdmin ? 'all' : row.booking_scope || 'none',
      bookingCanAssign: systemAdmin ? true : Boolean(row.booking_can_assign),
      bookingCanReassign: systemAdmin ? true : Boolean(row.booking_can_reassign),
      bookingCanTransition: systemAdmin ? true : Boolean(row.booking_can_transition),
      bookingCanCancel: systemAdmin ? true : Boolean(row.booking_can_cancel),
      bookingCanReschedule: systemAdmin ? true : Boolean(row.booking_can_reschedule),
      dealScope: systemAdmin ? 'all' : row.deal_scope || 'none',
      dealCanCreate: systemAdmin ? true : Boolean(row.deal_can_create),
      dealCanCreateDirect: systemAdmin ? true : Boolean(row.deal_can_create_direct),
      dealCanManageContractDeposit: systemAdmin ? true : Boolean(row.deal_can_manage_contract_deposit),
      dealCanManageRentalSchedule: systemAdmin ? true : Boolean(row.deal_can_manage_rental_schedule),
      dealCanManageLifecycle: systemAdmin ? true : Boolean(row.deal_can_manage_lifecycle),
      authMode,
    };
  }

  async resolveAuthorizationHeader(
    authorization: unknown,
  ): Promise<AppIdentity | null> {
    const token = bearerToken(authorization);
    if (!token) return null;

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);

      if (
        payload?.type !== 'access' ||
        !payload?.sub
      ) {
        return null;
      }

      return this.identityByUserId(payload.sub, 'postgres');
    } catch {
      return null;
    }
  }

  assertActive(identity: AppIdentity | null): AppIdentity {
    if (!identity) {
      throw new UnauthorizedException({
        success: false,
        error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
      });
    }

    if (!ACTIVE_STATUSES.has(normalizeStatus(identity.status))) {
      throw new ForbiddenException({
        success: false,
        pendingApproval:
          normalizeStatus(identity.status).includes('chờ') ||
          normalizeStatus(identity.status).includes('pending'),
        error: 'Tài khoản chưa được phép truy cập hệ thống.',
      });
    }

    return identity;
  }

  runtimeState() {
    return {
      provider: 'postgres',
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      accessJwtConfigured:
        String(process.env.JWT_ACCESS_SECRET || '').length >= 32,
      refreshConfigured:
        String(process.env.JWT_REFRESH_SECRET || '').length >= 32,
};
  }
}
