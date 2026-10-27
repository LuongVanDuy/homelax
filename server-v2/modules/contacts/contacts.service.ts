import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CollaboratorSummary, CollaboratorWrite, ContactListQuery, CustomerSummary, CustomerWrite } from '@tinyhouse/contracts';
import crypto from 'crypto';
import type { PoolClient, QueryResultRow } from 'pg';
import type { AppIdentity } from '../../common/auth/auth.types.js';
import { PostgresService } from '../../database/postgres.service.js';
import { ContactsAccessService } from './contacts-access.service.js';
import { escapedLike, pageOffset, pageResult } from '../../common/list/list-utils.js';

type ContactRow = QueryResultRow & {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  user_id: string | null;
  booking_ids?: string[] | null;
  deal_ids?: string[] | null;
  age?: number | null;
  age_recorded_at?: string | null;
  source_type?: string | null;
  source_channel?: string | null;
  referred_by_collaborator_id?: string | null;
  source_recorded_at?: string | Date | null;
  archived_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type ContactKind = 'customer' | 'collaborator';
type ContactWrite = CollaboratorWrite & {
  age?: number | null;
  sourceType?: string;
  sourceChannel?: string;
  referredByCollaboratorId?: string | null;
};

const CONTACT_TABLES = { customer: 'customers', collaborator: 'collaborators' } as const;
const CONTACT_COLUMNS = 'id, name, phone, email, address, notes, user_id, archived_at, created_at, updated_at';

function columns(kind: ContactKind) {
  return kind === 'customer'
    ? `${CONTACT_COLUMNS}, age, to_char(age_recorded_at, 'YYYY-MM-DD') AS age_recorded_at,
       source_type, source_channel, referred_by_collaborator_id, source_recorded_at`
    : CONTACT_COLUMNS;
}

function bookingLinkColumn(kind: ContactKind) {
  return kind === 'customer' ? 'customer_id' : 'collaborator_id';
}

function selectColumns(kind: ContactKind) {
  const table = CONTACT_TABLES[kind];
  const bookingColumn = bookingLinkColumn(kind);
  return `${columns(kind)}, COALESCE((
    SELECT array_agg(b.id ORDER BY b.created_at DESC)
    FROM bookings b
    WHERE b.${bookingColumn} = ${table}.id
  ), ARRAY[]::text[]) AS booking_ids, COALESCE((
    SELECT array_agg(d.id ORDER BY d.created_at DESC)
    FROM deals d
    WHERE d.${bookingColumn} = ${table}.id
  ), ARRAY[]::text[]) AS deal_ids`;
}

function isoDate(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function mapContact(row: ContactRow): CollaboratorSummary {
  return {
    id: row.id,
    name: row.name ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    address: row.address ?? '',
    notes: row.notes ?? '',
    userId: row.user_id ?? null,
    bookingIds: Array.isArray(row.booking_ids) ? row.booking_ids.map(String) : [],
    dealIds: Array.isArray(row.deal_ids) ? row.deal_ids.map(String) : [],
    archivedAt: row.archived_at ? isoDate(row.archived_at) : null,
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at),
  };
}

function mapCustomer(row: ContactRow): CustomerSummary {
  return {
    ...mapContact(row),
    age: row.age ?? null,
    ageRecordedAt: row.age_recorded_at ?? null,
    sourceType: row.source_type ?? '',
    sourceChannel: row.source_channel ?? '',
    referredByCollaboratorId: row.referred_by_collaborator_id ?? null,
    sourceRecordedAt: row.source_recorded_at ? isoDate(row.source_recorded_at) : null,
  };
}

@Injectable()
export class ContactsService {
  constructor(
    private readonly db: PostgresService,
    private readonly access: ContactsAccessService,
  ) {}

  private async list(kind: ContactKind, query: ContactListQuery) {
    const search = query.search.trim();
    const pattern = escapedLike(search);
    const sortColumn = {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      name: 'lower(name)',
    }[query.sort] || 'created_at';
    const order = query.order === 'asc' ? 'ASC' : 'DESC';
    const where = `
      WHERE ($1 = 'all' OR ($1 = 'active' AND archived_at IS NULL) OR ($1 = 'archived' AND archived_at IS NOT NULL))
        AND ($2 = '' OR name ILIKE $3 OR phone ILIKE $3 OR email ILIKE $3 OR id ILIKE $3)
    `;
    const params = [query.archived, search, pattern];
    const [rows, count] = await Promise.all([
      this.db.query<ContactRow>(
        `SELECT ${selectColumns(kind)} FROM ${CONTACT_TABLES[kind]}
         ${where}
         ORDER BY ${sortColumn} ${order}, id DESC
         LIMIT $4 OFFSET $5`,
        [...params, query.pageSize, pageOffset(query.page, query.pageSize)],
      ),
      this.db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM ${CONTACT_TABLES[kind]} ${where}`,
        params,
      ),
    ]);
    return {
      rows: rows.rows,
      total: Number(count.rows[0]?.count || 0),
    };
  }

  private async detail(kind: ContactKind, id: string) {
    const result = await this.db.query<ContactRow>(
      `SELECT ${selectColumns(kind)} FROM ${CONTACT_TABLES[kind]} WHERE id = $1`,
      [id],
    );
    if (!result.rows[0]) {
      throw new NotFoundException({ success: false, error: 'Không tìm thấy hồ sơ.' });
    }
    return result.rows[0];
  }

  private async lockProfile(client: PoolClient, kind: ContactKind, id: string) {
    const result = await client.query<ContactRow>(
      `SELECT ${columns(kind)} FROM ${CONTACT_TABLES[kind]} WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!result.rows[0]) {
      throw new NotFoundException({ success: false, error: 'Không tìm thấy hồ sơ.' });
    }
    return result.rows[0];
  }

  private async validateLinks(client: PoolClient, data: ContactWrite, kind: ContactKind) {
    if (data.userId) {
      const linkedUser = await client.query('SELECT id FROM users WHERE id = $1', [data.userId]);
      if (!linkedUser.rows[0]) {
        throw new ConflictException({ success: false, error: 'Tài khoản liên kết không còn tồn tại.' });
      }
    }

    if (kind === 'customer' && data.referredByCollaboratorId) {
      if (data.sourceType && data.sourceType !== 'ctv') {
        throw new ConflictException({ success: false, error: 'CTV giới thiệu chỉ dùng với nguồn CTV.' });
      }
      const collaborator = await client.query(
        'SELECT id FROM collaborators WHERE id = $1 AND archived_at IS NULL',
        [data.referredByCollaboratorId],
      );
      if (!collaborator.rows[0]) {
        throw new ConflictException({ success: false, error: 'CTV giới thiệu không tồn tại hoặc đã được lưu trữ.' });
      }
    }
  }

  private assertInitialSourceUnchanged(current: ContactRow, data: ContactWrite) {
    if (data.sourceType !== undefined && data.sourceType !== (current.source_type ?? '')) {
      throw new ConflictException({
        success: false,
        error: 'Nguồn ban đầu được giữ nguyên. Chính sách sửa attribution sẽ được chốt ở bước nghiệp vụ liên quan.',
      });
    }
    if (data.sourceChannel !== undefined && data.sourceChannel !== (current.source_channel ?? '')) {
      throw new ConflictException({
        success: false,
        error: 'Nguồn ban đầu được giữ nguyên. Chính sách sửa attribution sẽ được chốt ở bước nghiệp vụ liên quan.',
      });
    }
    if (
      data.referredByCollaboratorId !== undefined &&
      data.referredByCollaboratorId !== (current.referred_by_collaborator_id ?? null)
    ) {
      throw new ConflictException({
        success: false,
        error: 'Nguồn ban đầu được giữ nguyên. Chính sách sửa attribution sẽ được chốt ở bước nghiệp vụ liên quan.',
      });
    }
  }

  private async syncBookingLinks(client: PoolClient, kind: ContactKind, id: string, bookingIds?: string[]) {
    if (bookingIds === undefined) return;

    const uniqueIds = [...new Set(bookingIds.map(String).map((value) => value.trim()).filter(Boolean))];
    const linkColumn = bookingLinkColumn(kind);
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM bookings WHERE ${linkColumn} = $1 ORDER BY id FOR UPDATE`,
      [id],
    );
    const selectedSet = new Set(uniqueIds);
    const removedIds = existing.rows.map((row) => row.id).filter((bookingId) => !selectedSet.has(bookingId));
    if (removedIds.length > 0) {
      throw new ConflictException({
        success: false,
        error: 'Liên kết attribution đã ghi nhận không thể gỡ hoặc chuyển bằng chỉnh sửa hồ sơ thông thường. Chính sách sửa nguồn sẽ được chốt riêng tại D04.',
      });
    }
    if (uniqueIds.length === 0) return;

    const selected = await client.query<{
      id: string;
      customer_id: string | null;
      collaborator_id: string | null;
      source_type: string | null;
      source_channel: string | null;
      source_recorded_at: string | Date | null;
    }>(
      `SELECT id, customer_id, collaborator_id, source_type, source_channel, source_recorded_at
       FROM bookings WHERE id = ANY($1::text[]) FOR UPDATE`,
      [uniqueIds],
    );
    if (selected.rows.length !== uniqueIds.length) {
      throw new ConflictException({ success: false, error: 'Có lịch xem được chọn không còn tồn tại.' });
    }
    for (const booking of selected.rows) {
      const currentLink = kind === 'customer' ? booking.customer_id : booking.collaborator_id;
      if (currentLink && currentLink !== id) {
        throw new ConflictException({
          success: false,
          error: `Lịch xem ${booking.id} đã có attribution với hồ sơ khác. Không tự chuyển nguồn khi D04 chưa có chính sách điều chỉnh.`,
        });
      }
    }

    if (kind === 'customer') {
      const customerResult = await client.query<{
        source_type: string;
        source_channel: string;
        referred_by_collaborator_id: string | null;
        source_recorded_at: string | Date | null;
      }>(
        `SELECT source_type, source_channel, referred_by_collaborator_id, source_recorded_at
         FROM customers WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const customer = customerResult.rows[0];
      if (!customer) throw new NotFoundException({ success: false, error: 'Không tìm thấy hồ sơ khách hàng.' });

      const bookingCollaborators = [...new Set(selected.rows.map((row) => row.collaborator_id).filter(Boolean))] as string[];
      if (bookingCollaborators.length > 1) {
        throw new ConflictException({
          success: false,
          error: 'Các lịch được chọn đang có nhiều CTV khác nhau. D04 chưa chốt quy tắc nhiều nguồn nên không thể tự gộp attribution.',
        });
      }
      if (customer.referred_by_collaborator_id && bookingCollaborators[0]
          && customer.referred_by_collaborator_id !== bookingCollaborators[0]) {
        throw new ConflictException({
          success: false,
          error: 'CTV nguồn của khách không khớp CTV đã ghi nhận trên lịch xem.',
        });
      }
      if (!customer.referred_by_collaborator_id && bookingCollaborators[0]
          && customer.source_type && customer.source_type !== 'ctv') {
        throw new ConflictException({
          success: false,
          error: 'Khách đã có nguồn ban đầu khác CTV. D04 chưa cho phép đổi hoặc chồng nguồn.',
        });
      }

      const sourceRows = selected.rows.filter((row) => String(row.source_type || '').trim());
      const sourceTypes = [...new Set(sourceRows.map((row) => String(row.source_type || '').trim()))];
      if (!customer.source_type && sourceTypes.length > 1) {
        throw new ConflictException({
          success: false,
          error: 'Các lịch được chọn có nhiều nguồn khác nhau. D04 chưa chốt first/last touch nên không tự chọn nguồn cho khách.',
        });
      }
      const inheritedType = customer.source_type || sourceTypes[0] || (bookingCollaborators[0] ? 'ctv' : '');
      const inheritedSourceRow = sourceRows.find((row) => String(row.source_type || '').trim() === inheritedType) || sourceRows[0];
      const inheritedChannel = customer.source_channel || String(inheritedSourceRow?.source_channel || '');
      const inheritedRecordedAt = customer.source_recorded_at || inheritedSourceRow?.source_recorded_at || null;
      const inheritedCollaborator = customer.referred_by_collaborator_id || bookingCollaborators[0] || null;

      if (!customer.source_type || !customer.source_channel || !customer.source_recorded_at || !customer.referred_by_collaborator_id) {
        await client.query(
          `UPDATE customers SET
             source_type = CASE WHEN COALESCE(source_type, '') = '' THEN $2 ELSE source_type END,
             source_channel = CASE WHEN COALESCE(source_channel, '') = '' THEN $3 ELSE source_channel END,
             referred_by_collaborator_id = COALESCE(referred_by_collaborator_id, $4),
             source_recorded_at = COALESCE(source_recorded_at, $5::timestamptz, CASE WHEN $2 <> '' OR $4::text IS NOT NULL THEN NOW() ELSE NULL END),
             updated_at = NOW()
           WHERE id = $1`,
          [id, inheritedType, inheritedChannel, inheritedCollaborator, inheritedRecordedAt],
        );
      }

      await client.query(
        `UPDATE bookings AS b SET
           customer_id = $1,
           collaborator_id = COALESCE(b.collaborator_id, c.referred_by_collaborator_id),
           source_type = CASE WHEN COALESCE(b.source_type, '') = '' THEN c.source_type ELSE b.source_type END,
           source_channel = CASE WHEN COALESCE(b.source_channel, '') = '' THEN c.source_channel ELSE b.source_channel END,
           source_recorded_at = COALESCE(b.source_recorded_at, c.source_recorded_at),
           updated_at = NOW()
         FROM customers AS c
         WHERE c.id = $1 AND b.id = ANY($2::text[])`,
        [id, uniqueIds],
      );
      return;
    }

    const customerIds = [...new Set(selected.rows.map((row) => row.customer_id).filter(Boolean))] as string[];
    if (customerIds.length > 0) {
      const customers = await client.query<{
        id: string;
        source_type: string;
        referred_by_collaborator_id: string | null;
      }>(
        `SELECT id, source_type, referred_by_collaborator_id
         FROM customers WHERE id = ANY($1::text[]) FOR UPDATE`,
        [customerIds],
      );
      for (const customer of customers.rows) {
        if (customer.referred_by_collaborator_id && customer.referred_by_collaborator_id !== id) {
          throw new ConflictException({
            success: false,
            error: `Khách ${customer.id} đã có CTV giới thiệu khác. D04 chưa cho phép chuyển attribution.`,
          });
        }
        if (!customer.referred_by_collaborator_id && customer.source_type && customer.source_type !== 'ctv') {
          throw new ConflictException({
            success: false,
            error: `Khách ${customer.id} đã có nguồn ban đầu không phải CTV. D04 chưa cho phép chồng nguồn.`,
          });
        }
      }
      await client.query(
        `UPDATE customers SET
           referred_by_collaborator_id = COALESCE(referred_by_collaborator_id, $1),
           source_type = CASE WHEN COALESCE(source_type, '') = '' THEN 'ctv' ELSE source_type END,
           source_recorded_at = COALESCE(source_recorded_at, NOW()),
           updated_at = NOW()
         WHERE id = ANY($2::text[])`,
        [id, customerIds],
      );
    }

    await client.query(
      `UPDATE bookings SET
         collaborator_id = $1,
         source_type = CASE WHEN COALESCE(source_type, '') = '' THEN 'ctv' ELSE source_type END,
         source_recorded_at = COALESCE(source_recorded_at, NOW()),
         updated_at = NOW()
       WHERE id = ANY($2::text[])`,
      [id, uniqueIds],
    );
  }

  private async attachBookingIds(client: PoolClient, kind: ContactKind, row: ContactRow) {
    const linkColumn = bookingLinkColumn(kind);
    const result = await client.query<{ id: string }>(
      `SELECT id FROM bookings WHERE ${linkColumn} = $1 ORDER BY created_at DESC`,
      [row.id],
    );
    row.booking_ids = result.rows.map((booking) => booking.id);
    return row;
  }

  private async create(kind: ContactKind, data: ContactWrite, actor: AppIdentity) {
    return this.access.write(actor, async (client) => {
      await this.validateLinks(client, data, kind);
      const id = `${kind === 'customer' ? 'cust' : 'ctv'}_${crypto.randomUUID()}`;
      let result;
      if (kind === 'customer') {
        const referrerId = data.referredByCollaboratorId ?? null;
        const sourceType = data.sourceType ?? (referrerId ? 'ctv' : '');
        const sourceChannel = data.sourceChannel ?? '';
        result = await client.query<ContactRow>(
          `INSERT INTO customers (
             id, name, phone, email, address, notes, user_id, age, age_recorded_at,
             source_type, source_channel, referred_by_collaborator_id, source_recorded_at
           )
           VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,
             CASE WHEN $8::integer IS NULL THEN NULL ELSE CURRENT_DATE END,
             $9,$10,$11,
             CASE WHEN $9 = '' AND $10 = '' AND $11::text IS NULL THEN NULL ELSE NOW() END
           )
           RETURNING ${columns(kind)}`,
          [id, data.name, data.phone, data.email ?? '', data.address ?? '', data.notes ?? '',
            data.userId || null, data.age ?? null, sourceType, sourceChannel, referrerId],
        );
      } else {
        result = await client.query<ContactRow>(
          `INSERT INTO collaborators (id, name, phone, email, address, notes, user_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${columns(kind)}`,
          [id, data.name, data.phone, data.email ?? '', data.address ?? '', data.notes ?? '', data.userId || null],
        );
      }
      await this.syncBookingLinks(client, kind, id, data.bookingIds);
      await this.attachBookingIds(client, kind, result.rows[0]);
      await this.access.audit(client, actor, kind, id, 'CREATE');
      return result.rows[0];
    });
  }

  private async update(kind: ContactKind, id: string, data: ContactWrite, actor: AppIdentity) {
    return this.access.write(actor, async (client) => {
      const current = await this.lockProfile(client, kind, id);
      if (current.archived_at) {
        throw new ConflictException({ success: false, error: 'Hãy khôi phục hồ sơ trước khi chỉnh sửa.' });
      }
      await this.validateLinks(client, data, kind);
      if (kind === 'customer') this.assertInitialSourceUnchanged(current, data);
      const userId = data.userId === undefined ? current.user_id : data.userId || null;
      let result;
      if (kind === 'customer') {
        const age = data.age === undefined ? current.age ?? null : data.age;
        result = await client.query<ContactRow>(
          `UPDATE customers SET
             name = $2, phone = $3, email = $4, address = $5, notes = $6, user_id = $7,
             age = $8, age_recorded_at = CASE
               WHEN $8::integer IS NULL THEN NULL
               WHEN age IS DISTINCT FROM $8 THEN CURRENT_DATE
               ELSE age_recorded_at END,
             updated_at = NOW()
           WHERE id = $1 RETURNING ${columns(kind)}`,
          [id, data.name, data.phone, data.email ?? current.email ?? '',
            data.address ?? current.address ?? '', data.notes ?? current.notes ?? '', userId, age],
        );
      } else {
        result = await client.query<ContactRow>(
          `UPDATE collaborators SET
             name = $2, phone = $3, email = $4, address = $5, notes = $6, user_id = $7, updated_at = NOW()
           WHERE id = $1 RETURNING ${columns(kind)}`,
          [id, data.name, data.phone, data.email ?? current.email ?? '',
            data.address ?? current.address ?? '', data.notes ?? current.notes ?? '', userId],
        );
      }
      await this.syncBookingLinks(client, kind, id, data.bookingIds);
      await this.attachBookingIds(client, kind, result.rows[0]);
      await this.access.audit(client, actor, kind, id, 'UPDATE');
      return result.rows[0];
    });
  }

  private async setArchived(kind: ContactKind, id: string, archived: boolean, actor: AppIdentity) {
    return this.access.write(actor, async (client) => {
      const current = await this.lockProfile(client, kind, id);
      if (Boolean(current.archived_at) === archived) return current;
      const result = await client.query<ContactRow>(
        `UPDATE ${CONTACT_TABLES[kind]} SET archived_at = ${archived ? 'NOW()' : 'NULL'}, updated_at = NOW()
         WHERE id = $1 RETURNING ${columns(kind)}`,
        [id],
      );
      await this.access.audit(client, actor, kind, id, archived ? 'ARCHIVE' : 'RESTORE');
      return result.rows[0];
    });
  }

  async listCustomers(query: ContactListQuery) {
    const result = await this.list('customer', query);
    return pageResult(
      result.rows.map(mapCustomer),
      query.page,
      query.pageSize,
      result.total,
    );
  }

  async getCustomer(id: string): Promise<CustomerSummary> {
    return mapCustomer(await this.detail('customer', id));
  }

  async createCustomer(data: CustomerWrite, actor: AppIdentity): Promise<CustomerSummary> {
    return mapCustomer(await this.create('customer', data, actor));
  }

  async updateCustomer(id: string, data: CustomerWrite, actor: AppIdentity): Promise<CustomerSummary> {
    return mapCustomer(await this.update('customer', id, data, actor));
  }

  async archiveCustomer(id: string, actor: AppIdentity): Promise<CustomerSummary> {
    return mapCustomer(await this.setArchived('customer', id, true, actor));
  }

  async restoreCustomer(id: string, actor: AppIdentity): Promise<CustomerSummary> {
    return mapCustomer(await this.setArchived('customer', id, false, actor));
  }

  async listCollaborators(query: ContactListQuery) {
    const result = await this.list('collaborator', query);
    return pageResult(
      result.rows.map(mapContact),
      query.page,
      query.pageSize,
      result.total,
    );
  }

  async getCollaborator(id: string): Promise<CollaboratorSummary> {
    return mapContact(await this.detail('collaborator', id));
  }

  async createCollaborator(_data: CollaboratorWrite, _actor: AppIdentity): Promise<CollaboratorSummary> {
    throw new ConflictException({
      success: false,
      error: 'Cộng tác viên được tạo từ tài khoản người dùng có vai trò CTV.',
    });
  }

  async updateCollaborator(_id: string, _data: CollaboratorWrite, _actor: AppIdentity): Promise<CollaboratorSummary> {
    throw new ConflictException({
      success: false,
      error: 'Thông tin cộng tác viên đồng bộ từ tài khoản người dùng. Hãy chỉnh sửa trong Quản lý người dùng.',
    });
  }

  async archiveCollaborator(_id: string, _actor: AppIdentity): Promise<CollaboratorSummary> {
    throw new ConflictException({
      success: false,
      error: 'Để ngừng CTV, hãy đổi vai trò của tài khoản người dùng.',
    });
  }

  async restoreCollaborator(_id: string, _actor: AppIdentity): Promise<CollaboratorSummary> {
    throw new ConflictException({
      success: false,
      error: 'Để khôi phục CTV, hãy gán lại vai trò CTV cho tài khoản người dùng.',
    });
  }
}
