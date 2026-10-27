import { ForbiddenException, Injectable } from '@nestjs/common';
import crypto from 'crypto';
import type { PoolClient } from 'pg';
import type { AppIdentity } from '../../common/auth/auth.types.js';
import { PostgresService } from '../../database/postgres.service.js';

const ADMIN_ROLES = new Set(['admin', 'superadmin']);
const ACTIVE_STATUSES = new Set(['hoạt động', 'active', 'approved', 'enabled']);

@Injectable()
export class ContactsAccessService {
  constructor(private readonly db: PostgresService) {}

  async write<T>(actor: AppIdentity, operation: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.db.transaction(async (client) => {
      // Use the same lock as user/role administration, then refresh authority.
      await client.query('SELECT pg_advisory_xact_lock(74120, 1)');
      const result = await client.query<{ role_code: string | null; status: string }>(
        'SELECT role_code, status FROM users WHERE id = $1',
        [actor.id],
      );
      const current = result.rows[0];
      if (!current || !ADMIN_ROLES.has(current.role_code || '') || !ACTIVE_STATUSES.has(current.status.trim().toLowerCase())) {
        throw new ForbiddenException({ success: false, error: 'Bạn không có quyền quản lý hồ sơ khách hàng và cộng tác viên.' });
      }
      return operation(client);
    });
  }

  async audit(
    client: PoolClient,
    actor: AppIdentity,
    entityType: 'customer' | 'collaborator',
    entityId: string,
    action: 'CREATE' | 'UPDATE' | 'ARCHIVE' | 'RESTORE',
  ) {
    const actionLabels = { CREATE: 'Tạo', UPDATE: 'Cập nhật', ARCHIVE: 'Lưu trữ', RESTORE: 'Khôi phục' };
    const entityLabel = entityType === 'customer' ? 'khách hàng' : 'cộng tác viên';
    await client.query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, summary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [`LOG-${crypto.randomUUID()}`, actor.id, actor.name, actor.email, action, entityType, entityId,
        `${actionLabels[action]} hồ sơ ${entityLabel}.`],
    );
  }
}
