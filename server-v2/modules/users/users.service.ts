import { normalizeAccountPhone } from '@tinyhouse/contracts';
import { rethrowAccountContactError } from '../../common/auth/account-contact-error.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ProvisionUserRequest,
  UserProfileWrite,
  UserListQuery,
  UserStatus,
  UserSummary,
} from '@tinyhouse/contracts';
import argon2 from 'argon2';
import crypto from 'crypto';
import type { PoolClient, QueryResultRow } from 'pg';
import type { AppIdentity } from '../../common/auth/auth.types.js';
import { PostgresService } from '../../database/postgres.service.js';
import { escapedLike, pageOffset, pageResult } from '../../common/list/list-utils.js';

type UserRow = QueryResultRow & {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role_code: string | null;
  role_name: string | null;
  status: string;
  avatar: string | null;
  auth_provider: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

const USER_COLUMNS = `
  id, name, email, phone, role_code, role_name,
  status, avatar, auth_provider, created_at, updated_at
`;
const ADMIN_ROLES = new Set(['admin', 'superadmin']);
const CTV_ROLE_CODE = 'ctv_sale';
// Match AuthIdentityService while existing imported accounts are still supported.
const ACTIVE_STATUSES = ['hoạt động', 'active', 'approved', 'enabled'];

function canonicalStatus(status: string) {
  const value = status.trim().toLowerCase();
  if (ACTIVE_STATUSES.includes(value)) return 'Hoạt động';
  if (value === 'pending') return 'Chờ duyệt';
  if (value === 'locked' || value === 'disabled') return 'Đã khóa';
  if (value === 'rejected') return 'Từ chối';
  return status;
}

function mapUser(row: UserRow): UserSummary {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    roleCode: row.role_code || 'unassigned',
    roleName: row.role_name || 'Chưa phân quyền',
    status: canonicalStatus(row.status),
    avatar: row.avatar || '',
    authProvider: row.auth_provider || 'local',
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

function duplicateEmail(): never {
  throw new ConflictException({
    success: false,
    error: 'Email đã tồn tại.',
    details: [{ path: 'email', message: 'Email đã tồn tại.' }],
  });
}

@Injectable()
export class UsersService {
  constructor(private readonly db: PostgresService) {}

  async list(query: UserListQuery) {
    const search = query.search.trim();
    const pattern = escapedLike(search);
    const requestedStatus = query.review === 'pending' ? 'Chờ duyệt' : query.status;
    const statusAliases =
      requestedStatus === 'Hoạt động'
        ? ACTIVE_STATUSES
        : requestedStatus === 'Chờ duyệt'
          ? ['chờ duyệt', 'pending']
          : requestedStatus === 'Đã khóa'
            ? ['đã khóa', 'locked', 'disabled']
            : requestedStatus === 'Từ chối'
              ? ['từ chối', 'rejected']
              : [];
    const sortColumn = {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      name: 'lower(name)',
      email: 'lower(email)',
      role: 'lower(COALESCE(role_name, role_code, \'\'))',
      status: 'lower(status)',
    }[query.sort] || 'created_at';
    const order = query.order === 'asc' ? 'ASC' : 'DESC';
    const where = `
      WHERE ($1 = '' OR id ILIKE $2 OR name ILIKE $2 OR email ILIKE $2 OR COALESCE(phone, '') ILIKE $2)
        AND ($3 = '' OR role_code = $3)
        AND ($4::text[] = '{}'::text[] OR lower(trim(status)) = ANY($4::text[]))
    `;
    const params = [search, pattern, query.roleCode, statusAliases.map((value) => value.toLowerCase())];
    const [rows, count] = await Promise.all([
      this.db.query<UserRow>(
        `SELECT ${USER_COLUMNS} FROM users ${where}
         ORDER BY ${sortColumn} ${order}, id DESC
         LIMIT $5 OFFSET $6`,
        [...params, query.pageSize, pageOffset(query.page, query.pageSize)],
      ),
      this.db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM users ${where}`,
        params,
      ),
    ]);
    return pageResult(
      rows.rows.map(mapUser),
      query.page,
      query.pageSize,
      Number(count.rows[0]?.count || 0),
    );
  }

  async stats() {
    const result = await this.db.query<{ total: number; pending: number }>(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (
            WHERE lower(trim(status)) IN ('chờ duyệt', 'pending')
          )::int AS pending
        FROM users
      `,
    );
    return {
      total: Number(result.rows[0]?.total || 0),
      pending: Number(result.rows[0]?.pending || 0),
    };
  }

  private async adminWrite<T>(
    actor: AppIdentity | undefined,
    operation: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.db.transaction(async (client) => {
        // Serialize account administration across requests/processes so two
        // admins cannot concurrently remove each other's remaining access.
        await client.query('SELECT pg_advisory_xact_lock(74120, 1)');
        if (actor) {
          const current = await client.query<UserRow>(
            `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
            [actor.id],
          );
          const row = current.rows[0];
          if (!row || !ADMIN_ROLES.has(row.role_code || '') || canonicalStatus(row.status) !== 'Hoạt động') {
            throw new ForbiddenException({
              success: false,
              error: 'Quyền quản trị tài khoản đã thay đổi. Vui lòng đăng nhập lại.',
            });
          }
        }
        return operation(client);
      });
    } catch (error) {
      rethrowAccountContactError(error);
    }
  }

  private async existingUser(client: PoolClient, id: string) {
    const result = await client.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!result.rows[0]) {
      throw new NotFoundException({ success: false, error: 'Không tìm thấy tài khoản.' });
    }
    return result.rows[0];
  }

  private async existingRole(client: PoolClient, code: string) {
    const result = await client.query<{ code: string; name: string }>(
      'SELECT code, name FROM roles WHERE code = $1 FOR KEY SHARE',
      [code],
    );
    if (!result.rows[0]) {
      throw new BadRequestException({
        success: false,
        error: 'Vai trò không tồn tại.',
        details: [{ path: 'roleCode', message: 'Vai trò không tồn tại.' }],
      });
    }
    return result.rows[0];
  }

  private async assertEmailAvailable(client: PoolClient, email: string, id: string | null = null) {
    const result = await client.query(
      'SELECT id FROM users WHERE lower(email) = $1 AND ($2::text IS NULL OR id <> $2) LIMIT 1',
      [email, id],
    );
    if (result.rowCount) duplicateEmail();
  }

  private async assertAccessChange(
    client: PoolClient,
    actor: AppIdentity,
    current: UserRow,
    roleCode: string | null,
    status: string,
  ) {
    const changed = roleCode !== current.role_code || canonicalStatus(status) !== canonicalStatus(current.status);
    if (!changed) return false;

    if (actor.id === current.id) {
      throw new ForbiddenException({
        success: false,
        error: 'Không thể tự thay đổi vai trò hoặc trạng thái tài khoản đang đăng nhập.',
      });
    }

    const removingAdmin = ADMIN_ROLES.has(current.role_code || '') && canonicalStatus(current.status) === 'Hoạt động'
      && (!ADMIN_ROLES.has(roleCode || '') || canonicalStatus(status) !== 'Hoạt động');
    if (removingAdmin) {
      const result = await client.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM users
         WHERE role_code IN ('admin', 'superadmin')
           AND lower(trim(status)) = ANY($1::text[]) AND id <> $2`,
        [ACTIVE_STATUSES, current.id],
      );
      if (Number(result.rows[0]?.count || 0) === 0) {
        throw new ForbiddenException({
          success: false,
          error: 'Phải giữ ít nhất một tài khoản quản trị đang hoạt động.',
        });
      }
    }
    return true;
  }

  private async syncCollaboratorProfile(client: PoolClient, user: UserRow) {
    if (user.role_code === CTV_ROLE_CODE) {
      await client.query(
        `INSERT INTO collaborators (
           id, user_id, name, phone, email, address, notes, archived_at
         ) VALUES ($1,$2,$3,$4,$5,'','',NULL)
         ON CONFLICT (user_id) DO UPDATE SET
           name = EXCLUDED.name,
           phone = EXCLUDED.phone,
           email = EXCLUDED.email,
           archived_at = NULL,
           updated_at = NOW()`,
        [`ctv_user_${user.id}`, user.id, user.name, user.phone ?? '', user.email],
      );
      return;
    }

    await client.query(
      `UPDATE collaborators
       SET archived_at = COALESCE(archived_at, NOW()), updated_at = NOW()
       WHERE user_id = $1 AND archived_at IS NULL`,
      [user.id],
    );
  }

  private async revokeRefreshTokens(client: PoolClient, id: string) {
    await client.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [id],
    );
  }

  private async audit(
    client: PoolClient,
    actor: AppIdentity | undefined,
    targetId: string,
    action: string,
    summary: string,
  ) {
    await client.query(
      `INSERT INTO audit_logs (
        id, user_id, user_name, user_email, action, entity_type, entity_id, summary
       ) VALUES ($1,$2,$3,$4,$5,'user',$6,$7)`,
      [`LOG-${crypto.randomUUID()}`, actor?.id ?? 'system', actor?.name ?? 'Hệ thống',
        actor?.email ?? '', action, targetId, summary],
    );
  }

  async save(data: UserProfileWrite, actor: AppIdentity): Promise<UserSummary> {
    return this.adminWrite(actor, async (client) => {
      const current = await this.existingUser(client, data.id);
      const email = data.email.trim().toLowerCase();
      await this.assertEmailAvailable(client, email, current.id);
      const role = await this.existingRole(client, data.roleCode ?? current.role_code ?? 'unassigned');
      const status = data.status ?? current.status;
      const accessChanged = await this.assertAccessChange(client, actor, current, role.code, status);
      const result = await client.query<UserRow>(
        `UPDATE users SET name = $2, email = $3, phone = $4,
          role_code = $5, role_name = $6, status = $7, avatar = $8, updated_at = NOW()
         WHERE id = $1 RETURNING ${USER_COLUMNS}`,
        [current.id, data.name ?? current.name, email, data.phone === undefined ? current.phone ?? '' : normalizeAccountPhone(data.phone),
          role.code, role.name, status, data.avatar ?? current.avatar ?? ''],
      );
      const profileColumns = { gender: 'gender', birthDate: 'birth_date', address: 'address' } as const;
      const profileSets: string[] = [];
      const profileParams: unknown[] = [current.id];
      for (const [key, column] of Object.entries(profileColumns)) {
        const value = data[key as keyof typeof profileColumns];
        if (value === undefined) continue;
        profileParams.push(value);
        profileSets.push(column + " = $" + profileParams.length + (key === "birthDate" ? "::date" : ""));
      }
      if (profileSets.length) {
        await client.query('UPDATE users SET ' + profileSets.join(', ') + ', updated_at = NOW() WHERE id = $1', profileParams);
      }
      await this.syncCollaboratorProfile(client, result.rows[0]);
      if (accessChanged) await this.revokeRefreshTokens(client, current.id);
      await this.audit(client, actor, current.id, 'UPDATE', 'Cập nhật tài khoản người dùng.');
      return mapUser(result.rows[0]);
    });
  }

  async provision(data: ProvisionUserRequest, actor?: AppIdentity) {
    if (data.password.length < 8) {
      throw new BadRequestException({ success: false, error: 'Mật khẩu tạm phải có ít nhất 8 ký tự.' });
    }
    const passwordHash = await argon2.hash(data.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    // An omitted actor is reserved for trusted internal account provisioning.
    // Every HTTP call supplies the authenticated administrator.
    return this.adminWrite(actor, async (client) => {
      const email = data.email.trim().toLowerCase();
      await this.assertEmailAvailable(client, email);
      const role = await this.existingRole(client, data.roleCode);
      const result = await client.query<UserRow>(
        `INSERT INTO users (
          id, name, email, phone, password_hash,
          role_code, role_name, status, avatar, auth_provider
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'local') RETURNING ${USER_COLUMNS}`,
        [`usr_${crypto.randomUUID()}`, data.name, email, normalizeAccountPhone(data.phone), passwordHash,
          role.code, role.name, data.status ?? 'Hoạt động', data.avatar ?? ''],
      );
      await this.syncCollaboratorProfile(client, result.rows[0]);
      await this.audit(client, actor, result.rows[0].id, 'CREATE', 'Tạo tài khoản người dùng.');
      return { success: true as const, user: mapUser(result.rows[0]) };
    });
  }

  async resetPassword(id: string, newPassword: string, actor: AppIdentity) {
    if (actor.id === id) {
      throw new ForbiddenException({
        success: false,
        error: 'Hãy dùng chức năng Đổi mật khẩu trong hồ sơ để đổi mật khẩu của chính mình.',
      });
    }
    if (newPassword.length < 8) {
      throw new BadRequestException({ success: false, error: 'Mật khẩu mới phải có ít nhất 8 ký tự.' });
    }
    const hash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    return this.adminWrite(actor, async (client) => {
      await this.existingUser(client, id);
      await client.query('UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1', [id, hash]);
      await this.revokeRefreshTokens(client, id);
      await this.audit(client, actor, id, 'RESET_PASSWORD', 'Đặt lại mật khẩu tài khoản.');
      return { success: true as const, message: 'Mật khẩu đã được cập nhật.', userId: id };
    });
  }

  async updateStatus(id: string, status: UserStatus, actor: AppIdentity) {
    return this.adminWrite(actor, async (client) => {
      const current = await this.existingUser(client, id);
      const changed = await this.assertAccessChange(client, actor, current, current.role_code, status);
      const result = await client.query<UserRow>(
        `UPDATE users SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING ${USER_COLUMNS}`,
        [id, status],
      );
      await this.syncCollaboratorProfile(client, result.rows[0]);
      if (changed) await this.revokeRefreshTokens(client, id);
      await this.audit(client, actor, id, 'UPDATE_STATUS', `Cập nhật trạng thái tài khoản: ${status}.`);
      return { success: true as const, user: mapUser(result.rows[0]) };
    });
  }

  async remove(id: string, actor: AppIdentity) {
    if (actor.id === id) {
      throw new ForbiddenException({ success: false, error: 'Không thể xóa tài khoản đang đăng nhập.' });
    }
    return this.adminWrite(actor, async (client) => {
      const current = await this.existingUser(client, id);
      if (ADMIN_ROLES.has(current.role_code || '')) {
        throw new ForbiddenException({ success: false, error: 'Không thể xóa tài khoản quản trị cấp cao.' });
      }
      await client.query(
        `UPDATE collaborators
         SET archived_at = COALESCE(archived_at, NOW()), updated_at = NOW()
         WHERE user_id = $1`,
        [id],
      );
      await client.query('DELETE FROM users WHERE id = $1', [id]);
      await this.audit(client, actor, id, 'DELETE', 'Xóa tài khoản người dùng.');
      return { success: true as const, id };
    });
  }
}
