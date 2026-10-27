import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import crypto from 'crypto';
import {
  COMMISSION_CONFIG_BOUNDARY,
  type CollaboratorTypeAssignment,
  type CollaboratorTypeWrite,
  type CommissionAllocationTargetWrite,
} from '@tinyhouse/contracts';
import type { AppIdentity } from '../../common/auth/auth.types.js';
import { PostgresService } from '../../database/postgres.service.js';
import { AuditService } from '../audit/audit.service.js';

function iso(value: unknown) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function mapType(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    name: String(row.name || ''),
    description: String(row.description || ''),
    archivedAt: row.archived_at ? iso(row.archived_at) : null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function mapCollaborator(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    userId: row.user_id ? String(row.user_id) : null,
    name: String(row.name || ''),
    phone: String(row.phone || ''),
    email: String(row.email || ''),
    affiliateToken: row.affiliate_token ? String(row.affiliate_token) : null,
    collaboratorTypeId: row.collaborator_type_id ? String(row.collaborator_type_id) : null,
    collaboratorTypeName: String(row.collaborator_type_name || ''),
  };
}

function mapAllocationTarget(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    name: String(row.name || ''),
    targetKind: row.target_kind === 'department' ? 'department' as const : 'position' as const,
    percentage: Number(row.percentage || 0),
    isCtv: Boolean(row.is_ctv),
    isActive: Boolean(row.is_active),
    notes: String(row.notes || ''),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

@Injectable()
export class CommissionConfigService {
  constructor(
    private readonly db: PostgresService,
    private readonly audit: AuditService,
  ) {}

  boundary() {
    return COMMISSION_CONFIG_BOUNDARY;
  }

  async listTypes() {
    const result = await this.db.query(
      `SELECT * FROM collaborator_types ORDER BY archived_at NULLS FIRST, lower(name), id`,
    );
    return result.rows.map(mapType);
  }

  async createType(actor: AppIdentity, data: CollaboratorTypeWrite) {
    const existing = await this.db.query(
      `SELECT id FROM collaborator_types WHERE lower(btrim(name)) = lower(btrim($1)) AND archived_at IS NULL LIMIT 1`,
      [data.name],
    );
    if (existing.rows[0]) {
      throw new ConflictException({ error: 'Loại CTV đang hoạt động với tên này đã tồn tại.' });
    }
    const id = `CTVT-${crypto.randomUUID()}`;
    const result = await this.db.query(
      `INSERT INTO collaborator_types (id, name, description) VALUES ($1,$2,$3) RETURNING *`,
      [id, data.name, data.description || ''],
    );
    await this.audit.create({
      user: actor, action: 'CREATE', entityType: 'collaborator_type', entityId: id,
      summary: `${actor.name || 'Admin'} đã tạo loại CTV ${data.name}`,
      metadata: { name: data.name },
    }).catch(() => undefined);
    return mapType(result.rows[0]);
  }

  async updateType(actor: AppIdentity, id: string, data: CollaboratorTypeWrite) {
    const duplicate = await this.db.query(
      `SELECT id FROM collaborator_types WHERE lower(btrim(name)) = lower(btrim($1)) AND id <> $2 AND archived_at IS NULL LIMIT 1`,
      [data.name, id],
    );
    if (duplicate.rows[0]) {
      throw new ConflictException({ error: 'Loại CTV đang hoạt động với tên này đã tồn tại.' });
    }
    const result = await this.db.query(
      `UPDATE collaborator_types SET name = $2, description = $3, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, data.name, data.description || ''],
    );
    if (!result.rows[0]) throw new NotFoundException({ error: 'Không tìm thấy loại CTV.' });
    await this.audit.create({
      user: actor, action: 'UPDATE', entityType: 'collaborator_type', entityId: id,
      summary: `${actor.name || 'Admin'} đã cập nhật loại CTV ${data.name}`,
      metadata: { name: data.name },
    }).catch(() => undefined);
    return mapType(result.rows[0]);
  }

  async archiveType(actor: AppIdentity, id: string, archived: boolean) {
    const result = await this.db.query(
      `
        UPDATE collaborator_types
        SET archived_at = CASE WHEN $2 THEN COALESCE(archived_at, NOW()) ELSE NULL END,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [id, archived],
    );
    if (!result.rows[0]) throw new NotFoundException({ error: 'Không tìm thấy loại CTV.' });
    await this.audit.create({
      user: actor, action: 'UPDATE', entityType: 'collaborator_type', entityId: id,
      summary: archived
        ? `${actor.name || 'Admin'} đã lưu trữ loại CTV ${result.rows[0].name}`
        : `${actor.name || 'Admin'} đã khôi phục loại CTV ${result.rows[0].name}`,
      metadata: { archived },
    }).catch(() => undefined);
    return mapType(result.rows[0]);
  }

  async listCollaborators() {
    const result = await this.db.query(
      `
        SELECT c.id, c.user_id, c.name, c.phone, c.email, c.affiliate_token, c.collaborator_type_id,
               COALESCE(ct.name, '') AS collaborator_type_name
        FROM collaborators c
        JOIN users u ON u.id = c.user_id
        LEFT JOIN collaborator_types ct ON ct.id = c.collaborator_type_id
        WHERE c.archived_at IS NULL
          AND lower(COALESCE(u.role_code, '')) = 'ctv_sale'
          AND lower(btrim(COALESCE(u.status, ''))) IN ('hoạt động','active','approved','enabled')
        ORDER BY lower(c.name), c.id
      `,
    );
    return result.rows.map(mapCollaborator);
  }

  async assignCollaboratorType(actor: AppIdentity, collaboratorId: string, data: CollaboratorTypeAssignment) {
    if (data.collaboratorTypeId) {
      const type = await this.db.query(
        `SELECT id FROM collaborator_types WHERE id = $1 AND archived_at IS NULL LIMIT 1`,
        [data.collaboratorTypeId],
      );
      if (!type.rows[0]) {
        throw new BadRequestException({ error: 'Loại CTV không tồn tại hoặc đã được lưu trữ.' });
      }
    }
    const result = await this.db.query(
      `UPDATE collaborators SET collaborator_type_id = $2, updated_at = NOW() WHERE id = $1 AND archived_at IS NULL RETURNING id`,
      [collaboratorId, data.collaboratorTypeId],
    );
    if (!result.rows[0]) throw new NotFoundException({ error: 'Không tìm thấy hồ sơ CTV đang hoạt động.' });
    await this.audit.create({
      user: actor, action: 'UPDATE', entityType: 'collaborator', entityId: collaboratorId,
      summary: `${actor.name || 'Admin'} đã cập nhật loại CTV cho ${collaboratorId}`,
      metadata: { collaboratorTypeId: data.collaboratorTypeId },
    }).catch(() => undefined);
    const detail = await this.db.query(
      `
        SELECT c.id, c.user_id, c.name, c.phone, c.email, c.affiliate_token, c.collaborator_type_id,
               COALESCE(ct.name, '') AS collaborator_type_name
        FROM collaborators c
        LEFT JOIN collaborator_types ct ON ct.id = c.collaborator_type_id
        WHERE c.id = $1 LIMIT 1
      `,
      [collaboratorId],
    );
    return mapCollaborator(detail.rows[0]);
  }

  async listAllocationTargets() {
    const result = await this.db.query(
      `SELECT * FROM commission_allocation_targets ORDER BY is_active DESC, is_ctv DESC, target_kind, lower(name), id`,
    );
    return result.rows.map(mapAllocationTarget);
  }

  async allocationStatus() {
    const result = await this.db.query<{
      active_percentage_total: string | number;
      active_target_count: number;
      active_ctv_target_count: number;
      ctv_target_id: string | null;
      ctv_target_name: string | null;
    }>(
      `
        SELECT
          COALESCE(SUM(percentage) FILTER (WHERE is_active), 0) AS active_percentage_total,
          COUNT(*) FILTER (WHERE is_active)::int AS active_target_count,
          COUNT(*) FILTER (WHERE is_active AND is_ctv)::int AS active_ctv_target_count,
          MIN(id) FILTER (WHERE is_active AND is_ctv) AS ctv_target_id,
          MIN(name) FILTER (WHERE is_active AND is_ctv) AS ctv_target_name
        FROM commission_allocation_targets
      `,
    );
    const row = result.rows[0];
    const total = Number(row?.active_percentage_total || 0);
    const ctvCount = Number(row?.active_ctv_target_count || 0);
    return {
      activePercentageTotal: total,
      remainingPercentage: 100 - total,
      activeTargetCount: Number(row?.active_target_count || 0),
      activeCtvTargetCount: ctvCount,
      ctvTargetId: ctvCount === 1 ? row?.ctv_target_id || null : null,
      ctvTargetName: ctvCount === 1 ? String(row?.ctv_target_name || '') : '',
      readyForCalculation: Math.abs(total - 100) < 0.0001 && ctvCount === 1,
    };
  }

  async saveAllocationTarget(actor: AppIdentity, id: string | null, data: CommissionAllocationTargetWrite) {
    const duplicate = await this.db.query(
      `SELECT id FROM commission_allocation_targets WHERE lower(btrim(name)) = lower(btrim($1)) AND ($2 = '' OR id <> $2) LIMIT 1`,
      [data.name, id || ''],
    );
    if (duplicate.rows[0]) {
      throw new ConflictException({ error: 'Phòng ban/vị trí với tên này đã tồn tại.' });
    }
    const totals = await this.db.query<{ percentage: string | number; ctv_count: number }>(
      `
        SELECT
          COALESCE(SUM(percentage) FILTER (WHERE is_active AND ($1 = '' OR id <> $1)), 0) AS percentage,
          COUNT(*) FILTER (WHERE is_active AND is_ctv AND ($1 = '' OR id <> $1))::int AS ctv_count
        FROM commission_allocation_targets
      `,
      [id || ''],
    );
    const nextTotal = Number(totals.rows[0]?.percentage || 0) + (data.isActive ? data.percentage : 0);
    if (nextTotal > 100.0001) {
      throw new BadRequestException({ error: `Tổng tỷ lệ đang hoạt động không được vượt 100%. Sau thay đổi sẽ là ${nextTotal}%.` });
    }
    if (data.isActive && data.isCtv && Number(totals.rows[0]?.ctv_count || 0) > 0) {
      throw new ConflictException({ error: 'Chỉ được có một vị trí CTV đang hoạt động trong cơ cấu phân bổ.' });
    }

    const targetId = id || `CAT-${crypto.randomUUID()}`;
    const params = [targetId, data.name, data.targetKind, data.percentage, data.isCtv, data.isActive, data.notes || '', actor.id];
    const result = id
      ? await this.db.query(
          `UPDATE commission_allocation_targets
           SET name=$2,target_kind=$3,percentage=$4,is_ctv=$5,is_active=$6,notes=$7,updated_by_user_id=$8,updated_at=NOW()
           WHERE id=$1 RETURNING *`,
          params,
        )
      : await this.db.query(
          `INSERT INTO commission_allocation_targets
           (id,name,target_kind,percentage,is_ctv,is_active,notes,created_by_user_id,updated_by_user_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *`,
          params,
        );
    if (!result.rows[0]) throw new NotFoundException({ error: 'Không tìm thấy cấu hình phân bổ.' });
    await this.audit.create({
      user: actor, action: id ? 'UPDATE' : 'CREATE',
      entityType: 'commission_allocation_target', entityId: targetId,
      summary: `${actor.name || 'Admin'} đã lưu cơ cấu phân bổ ${data.name}`,
      metadata: { targetKind: data.targetKind, percentage: data.percentage, isCtv: data.isCtv, isActive: data.isActive },
    }).catch(() => undefined);
    return mapAllocationTarget(result.rows[0]);
  }
}
