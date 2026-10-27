import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  accountDetailSchema, accountPermissionsSchema, accountActivityPageSchema,
  accountLinkedProfilesPageSchema, type AccountRelatedQuery,
} from '@tinyhouse/contracts';
import type { AppIdentity } from '../../common/auth/auth.types.js';
import { AuthIdentityService } from '../../common/auth/auth-identity.service.js';
import { PostgresService } from '../../database/postgres.service.js';
import { pageOffset, pageResult } from '../../common/list/list-utils.js';
import { RETENTION_DAYS } from '../audit/audit.service.js';

function iso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Explicit safe read models. No SELECT * from users, refresh tokens or audit. */
@Injectable()
export class UserAccountService {
  constructor(
    private readonly db: PostgresService,
    private readonly identity: AuthIdentityService,
  ) {}

  private assertAdmin(actor: AppIdentity) {
    if (!['admin', 'superadmin'].includes(actor.roleCode)) {
      throw new ForbiddenException({ error: 'Bạn không có quyền quản lý tài khoản.' });
    }
  }

  private async requireUser(id: string) {
    const user = await this.identity.identityByUserId(id);
    if (!user) throw new NotFoundException({ error: 'Không tìm thấy tài khoản.' });
    return user;
  }

  async detail(id: string, actor: AppIdentity) {
    if (id !== actor.id) this.assertAdmin(actor);
    const identity = await this.requireUser(id);
    const result = await this.db.query<{
      id: string; auth_provider: string; created_at: Date; updated_at: Date;
      gender: 'male' | 'female' | 'other' | null; birth_date: string | null;
      address: string; password_set: boolean; active_sessions: number; last_refresh_at: Date | null;
      email_verified_at: Date | null;
    }>(
      `SELECT u.id, u.auth_provider, u.created_at, u.updated_at,
              u.gender, u.birth_date::text AS birth_date, u.address, u.email_verified_at,
              (u.password_hash IS NOT NULL AND u.password_hash <> '') AS password_set,
              (SELECT COUNT(*)::int FROM refresh_tokens r
               WHERE r.user_id = u.id AND r.revoked_at IS NULL AND r.expires_at > NOW()) AS active_sessions,
              (SELECT MAX(r.last_used_at) FROM refresh_tokens r WHERE r.user_id = u.id) AS last_refresh_at
       FROM users u WHERE u.id = $1`, [id],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException({ error: 'Không tìm thấy tài khoản.' });
    return accountDetailSchema.parse({
      user: {
        id: identity.id, name: identity.name, email: identity.email,
        phone: identity.phone || '', avatar: identity.avatar || '',
        roleCode: identity.roleCode, roleName: identity.roleName, status: identity.status,
        authProvider: row.auth_provider || 'local',
        createdAt: iso(row.created_at) || '', updatedAt: iso(row.updated_at) || '',
        gender: row.gender ?? null, birthDate: row.birth_date ?? null, address: row.address || '',
        emailVerifiedAt: iso(row.email_verified_at),
      },
      permissions: accountPermissionsSchema.parse(identity),
      security: {
        passwordSet: Boolean(row.password_set),
        activeRefreshSessions: Number(row.active_sessions || 0),
        lastRefreshAt: iso(row.last_refresh_at),
      },
    });
  }

  async linkedProfiles(id: string, actor: AppIdentity, query: AccountRelatedQuery) {
    this.assertAdmin(actor);
    await this.requireUser(id);
    const source = `
      SELECT id, name, archived_at, 'customer'::text AS kind FROM customers WHERE user_id = $1
      UNION ALL
      SELECT id, name, archived_at, 'collaborator'::text AS kind FROM collaborators WHERE user_id = $1
    `;
    const [rows, total] = await Promise.all([
      this.db.query<{ id: string; name: string; archived_at: Date | null; kind: string }>(
        `SELECT * FROM (${source}) profiles ORDER BY kind, id LIMIT $2 OFFSET $3`,
        [id, query.pageSize, pageOffset(query.page, query.pageSize)],
      ),
      this.db.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM (${source}) profiles`, [id]),
    ]);
    return accountLinkedProfilesPageSchema.parse(pageResult(
      rows.rows.map((row) => ({ id: row.id, name: row.name || '', kind: row.kind, archivedAt: iso(row.archived_at) })),
      query.page, query.pageSize, Number(total.rows[0]?.count || 0),
    ));
  }

  async activity(id: string, actor: AppIdentity, query: AccountRelatedQuery) {
    this.assertAdmin(actor);
    await this.requireUser(id);
    // Includes actions by this user and administration of this account, not
    // business activity merely sharing an email/phone or a free-text match.
    const where = `WHERE (user_id = $1 OR (entity_type = 'user' AND entity_id = $1))
      AND created_at >= NOW() - $2::int * INTERVAL '1 day'`;
    const [rows, total] = await Promise.all([
      this.db.query<{
        id: string; user_id: string; user_name: string; user_email: string;
        action: string; entity_type: string; entity_id: string; summary: string; created_at: Date;
      }>(
        `SELECT id, user_id, user_name, user_email, action, entity_type, entity_id, summary, created_at
         FROM audit_logs ${where} ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $4`,
        [id, RETENTION_DAYS, query.pageSize, pageOffset(query.page, query.pageSize)],
      ),
      this.db.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM audit_logs ${where}`, [id, RETENTION_DAYS]),
    ]);
    return accountActivityPageSchema.parse({
      ...pageResult(rows.rows.map((row) => ({
        id: row.id, userId: row.user_id || '', userName: row.user_name || '', userEmail: row.user_email || '',
        action: row.action || '', entityType: row.entity_type || '', entityId: row.entity_id || '',
        summary: row.summary || '', createdAt: iso(row.created_at),
      })), query.page, query.pageSize, Number(total.rows[0]?.count || 0)),
      retentionDays: RETENTION_DAYS,
    });
  }
}
