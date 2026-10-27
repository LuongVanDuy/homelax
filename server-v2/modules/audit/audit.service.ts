import { Injectable } from '@nestjs/common';
import crypto from 'crypto';
import { PostgresService } from '../../database/postgres.service.js';
import type { AuditListQuery } from '@tinyhouse/contracts';
import { escapedLike, pageOffset, pageResult } from '../../common/list/list-utils.js';
import { mapAuditRow } from '../../database/row-mappers.js';

export const RETENTION_DAYS = 7;

@Injectable()
export class AuditService {
  constructor(private readonly db: PostgresService) {}

  async list(query: AuditListQuery) {
    await this.cleanup();
    const search = query.search.trim();
    const pattern = escapedLike(search);
    const where = `
      WHERE created_at >= NOW() - INTERVAL '7 days'
        AND ($1 = '' OR action = $1)
        AND ($2 = '' OR entity_type = $2)
        AND ($3 = '' OR user_name ILIKE $4 OR user_email ILIKE $4 OR summary ILIKE $4 OR entity_id ILIKE $4)
    `;
    const params = [query.action, query.entityType, search, pattern];
    const [rows, count] = await Promise.all([
      this.db.query(
        `SELECT * FROM audit_logs ${where}
         ORDER BY created_at ${query.order === 'asc' ? 'ASC' : 'DESC'}, id DESC
         LIMIT $5 OFFSET $6`,
        [...params, query.pageSize, pageOffset(query.page, query.pageSize)],
      ),
      this.db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM audit_logs ${where}`,
        params,
      ),
    ]);
    return {
      ...pageResult(
        rows.rows.map(mapAuditRow),
        query.page,
        query.pageSize,
        Number(count.rows[0]?.count || 0),
      ),
      retentionDays: RETENTION_DAYS,
    };
  }

  async create(data: {
    user?: any;
    action?: string;
    entityType?: string;
    entityId?: string;
    summary: string;
    metadata?: Record<string, unknown>;
  }) {
    const id = `LOG-${Date.now()}-${crypto.randomInt(1000, 9999)}`;

    const result = await this.db.query(
      `
        INSERT INTO audit_logs (
          id,
          user_id,
          user_name,
          user_email,
          action,
          entity_type,
          entity_id,
          summary,
          metadata
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb
        )
        RETURNING *
      `,
      [
        id,
        data.user?.id || 'unknown',
        data.user?.name || data.user?.email || 'Người dùng',
        data.user?.email || '',
        String(data.action || 'UPDATE').toUpperCase(),
        String(data.entityType || 'other').toLowerCase(),
        String(data.entityId || ''),
        String(data.summary || '').trim(),
        JSON.stringify(data.metadata || {}),
      ],
    );

    return {
      success: true,
      data: mapAuditRow(result.rows[0]),
    };
  }

  async cleanup() {
    await this.db.query(
      `
        DELETE FROM audit_logs
        WHERE created_at < NOW() - INTERVAL '7 days'
      `,
    );
  }
}
