import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import crypto from 'crypto';
import {
  publicRoomTypeCatalogSchema,
  roomTypeCatalogSchema,
  type PublicRoomTypeCatalogListQuery,
  type RoomTypeCatalogListQuery,
  type RoomTypeCatalogWrite,
} from '@tinyhouse/contracts';
import { PostgresService } from '../../database/postgres.service.js';
import { escapedLike, pageOffset, pageResult } from '../../common/list/list-utils.js';
import { AuditService } from '../audit/audit.service.js';

const ids = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);

function mapCatalog(row: Record<string, any>) {
  return roomTypeCatalogSchema.parse({
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    status: row.status,
    sortOrder: Number(row.sort_order || 0),
    source: String(row.source || 'admin'),
    assignmentCount: Number(row.assignment_count || 0),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at || null,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at || null,
  });
}

@Injectable()
export class RoomTypeCatalogService {
  constructor(private readonly db: PostgresService, private readonly audit: AuditService) {}

  async publicList(query: PublicRoomTypeCatalogListQuery) {
    const search = query.search.trim();
    const pattern = escapedLike(search);
    const selectedIds = ids(query.ids);
    const sort = query.sort === 'name' ? 'lower(c.name)' : 'c.sort_order';
    const order = query.order === 'desc' ? 'DESC' : 'ASC';
    const where = `
      WHERE c.status = 'active'
        AND ($1 = '' OR c.name ILIKE $2)
        AND ($3::text[] = '{}'::text[] OR c.id = ANY($3::text[]))
    `;
    const params = [search, pattern, selectedIds];
    const [rows, count] = await Promise.all([
      this.db.query(
        `SELECT c.id, c.name, c.sort_order, c.status
         FROM room_type_catalog c ${where}
         ORDER BY ${sort} ${order}, lower(c.name), c.id
         LIMIT $4 OFFSET $5`,
        [...params, query.pageSize, pageOffset(query.page, query.pageSize)],
      ),
      this.db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM room_type_catalog c ${where}`,
        params,
      ),
    ]);
    return pageResult(
      rows.rows.map(row => publicRoomTypeCatalogSchema.parse({
        id: String(row.id),
        name: String(row.name),
        sortOrder: Number(row.sort_order || 0),
        status: 'active',
      })),
      query.page,
      query.pageSize,
      Number(count.rows[0]?.count || 0),
    );
  }

  async list(query: RoomTypeCatalogListQuery) {
    const search = query.search.trim();
    const pattern = escapedLike(search);
    const selectedIds = ids(query.ids);
    const sort = {
      sortOrder: 'c.sort_order',
      name: 'lower(c.name)',
      assignmentCount: 'assignment_count',
      updatedAt: 'c.updated_at',
    }[query.sort];
    const order = query.order === 'desc' ? 'DESC' : 'ASC';
    const where = `
      WHERE ($1 = '' OR c.status = $1)
        AND ($2 = '' OR c.name ILIKE $3 OR c.code ILIKE $3)
        AND ($4::text[] = '{}'::text[] OR c.id = ANY($4::text[]))
    `;
    const params = [query.status, search, pattern, selectedIds];
    const base = `
      SELECT c.*, (SELECT COUNT(*) FROM rooms r WHERE r.room_type_catalog_id = c.id) AS assignment_count
      FROM room_type_catalog c
      ${where}
    `;
    const [rows, count] = await Promise.all([
      this.db.query(
        `${base}
         ORDER BY ${sort} ${order}, lower(c.name), c.id
         LIMIT $5 OFFSET $6`,
        [...params, query.pageSize, pageOffset(query.page, query.pageSize)],
      ),
      this.db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM room_type_catalog c ${where}`,
        params,
      ),
    ]);
    return pageResult(rows.rows.map(mapCatalog), query.page, query.pageSize, Number(count.rows[0]?.count || 0));
  }

  async save(data: RoomTypeCatalogWrite, user: any, id?: string) {
    const existing = id
      ? await this.db.query('SELECT * FROM room_type_catalog WHERE id = $1 LIMIT 1', [id])
      : null;
    if (id && !existing?.rows[0]) throw new NotFoundException({ error: 'Loại phòng không tồn tại.' });
    const current = existing?.rows[0] || null;
    const duplicate = await this.db.query<{ id: string }>(
      `SELECT id FROM room_type_catalog
       WHERE lower(btrim(name)) = lower(btrim($1)) AND id <> $2 LIMIT 1`,
      [data.name, id || ''],
    );
    if (duplicate.rows[0]) throw new ConflictException({ error: 'Tên loại phòng đã tồn tại.' });

    const catalogId = id || `RTC-${crypto.randomUUID()}`;
    const code = current?.code || `room-type-${crypto.randomUUID().slice(0, 12)}`;
    const result = await this.db.transaction(async client => {
      const saved = await client.query(
        `INSERT INTO room_type_catalog (id, code, name, status, sort_order, source, updated_at)
         VALUES ($1,$2,$3,'active',$4,'admin',NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           sort_order = EXCLUDED.sort_order,
           updated_at = NOW()
         RETURNING *`,
        [catalogId, code, data.name, data.sortOrder],
      );
      if (current && String(current.name) !== data.name) {
        await client.query(
          `UPDATE rooms SET type = $2, updated_at = NOW()
           WHERE room_type_catalog_id = $1
             AND lower(btrim(type)) = lower(btrim($3))`,
          [catalogId, data.name, current.name],
        );
      }
      return saved.rows[0];
    });
    await this.audit.create({
      user,
      action: current ? 'UPDATE' : 'CREATE',
      entityType: 'room_type_catalog',
      entityId: catalogId,
      summary: `${user?.name || 'Admin'} đã ${current ? 'cập nhật' : 'tạo'} danh mục loại phòng ${data.name}`,
    }).catch(() => undefined);
    const count = await this.assignmentCount(catalogId);
    return mapCatalog({ ...result, assignment_count: count });
  }

  async archive(id: string, user: any) { return this.setStatus(id, 'archived', user); }
  async restore(id: string, user: any) { return this.setStatus(id, 'active', user); }

  async remove(id: string, user: any) {
    const current = await this.db.query('SELECT * FROM room_type_catalog WHERE id = $1 LIMIT 1', [id]);
    if (!current.rows[0]) throw new NotFoundException({ error: 'Loại phòng không tồn tại.' });
    if (await this.assignmentCount(id)) {
      throw new ConflictException({ error: 'Loại phòng đang được sử dụng. Hãy lưu trữ thay vì xóa.' });
    }
    await this.db.query('DELETE FROM room_type_catalog WHERE id = $1', [id]);
    await this.audit.create({
      user, action: 'DELETE', entityType: 'room_type_catalog', entityId: id,
      summary: `${user?.name || 'Admin'} đã xóa danh mục loại phòng ${current.rows[0].name}`,
    }).catch(() => undefined);
    return { success: true, id };
  }

  private async setStatus(id: string, status: 'active' | 'archived', user: any) {
    const result = await this.db.query(
      'UPDATE room_type_catalog SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id, status],
    );
    if (!result.rows[0]) throw new NotFoundException({ error: 'Loại phòng không tồn tại.' });
    await this.audit.create({
      user,
      action: status === 'active' ? 'RESTORE' : 'ARCHIVE',
      entityType: 'room_type_catalog',
      entityId: id,
      summary: `${user?.name || 'Admin'} đã ${status === 'active' ? 'khôi phục' : 'lưu trữ'} danh mục loại phòng ${result.rows[0].name}`,
    }).catch(() => undefined);
    return mapCatalog({ ...result.rows[0], assignment_count: await this.assignmentCount(id) });
  }

  private async assignmentCount(id: string) {
    const result = await this.db.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM rooms WHERE room_type_catalog_id = $1',
      [id],
    );
    return Number(result.rows[0]?.count || 0);
  }
}
