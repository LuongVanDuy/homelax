import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import crypto from 'node:crypto';
import { intakeSummarySchema, intakeTransitions, normalizeAccountPhone, type IntakeCreate, type IntakeListQuery, type IntakeUpdate } from '@tinyhouse/contracts';
import type { AppIdentity } from '../../common/auth/auth.types.js';
import { PostgresService } from '../../database/postgres.service.js';
import { getRequiredEnv } from '../../config/environment.js';

const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const fields = `id, kind, name, phone, need, status, revision, created_at AS "createdAt", updated_at AS "updatedAt"`;
function summary(row: Record<string, unknown>) {
  return intakeSummarySchema.parse({ ...row,
    createdAt: new Date(row.createdAt as string).toISOString(), updatedAt: new Date(row.updatedAt as string).toISOString() });
}

@Injectable()
export class IntakeService {
  constructor(private readonly db: PostgresService) {}

  async create(input: IntakeCreate, ip: string) {
    const phone = normalizeAccountPhone(input.phone);
    const keyHash = hash(input.requestKey);
    const payloadHash = hash(JSON.stringify([input.kind, input.name, phone, input.need]));
    const privateHash = (value: string) => crypto.createHmac('sha256', getRequiredEnv('JWT_REFRESH_SECRET')).update(value).digest('hex');
    const phoneHash = privateHash(`intake-phone:${phone}`);
    const ipHash = privateHash(`intake-ip:${ip.replace(/^::ffff:/, '')}`);
    return this.db.transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`intake-key:${keyHash}`]);
      const previous = await client.query('SELECT id, payload_hash FROM intake_requests WHERE request_key_hash = $1', [keyHash]);
      if (previous.rows[0]) {
        if (previous.rows[0].payload_hash !== payloadHash) throw new ConflictException({ error: 'Lần gửi này đã dùng cho nội dung khác. Vui lòng tạo lần gửi mới.', code: 'INTAKE_KEY_CONFLICT' });
        return { success: true as const, receiptId: previous.rows[0].id as string };
      }
      // Lock both dimensions across processes; a retry of a committed request bypasses limits.
      for (const key of [`intake-phone:${phoneHash}`, `intake-ip:${ipHash}`].sort()) {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
      }
      const { rows: [clock] } = await client.query<{ now: Date }>('SELECT clock_timestamp() AS now');
      const now = clock.now;
      const { rows } = await client.query<{ phone_hash: string; ip_hash: string; created_at: Date }>(
        `SELECT phone_hash, ip_hash, created_at FROM intake_rate_events
         WHERE created_at > $3::timestamptz - INTERVAL '1 hour' AND (phone_hash = $1 OR ip_hash = $2)
         ORDER BY created_at`, [phoneHash, ipHash, now]);
      const phones = rows.filter(row => row.phone_hash === phoneHash);
      const ips = rows.filter(row => row.ip_hash === ipHash);
      const waits = [0];
      const remaining = (at: Date, seconds: number) => Math.ceil((at.getTime() + seconds * 1000 - now.getTime()) / 1000);
      if (phones.length) waits.push(remaining(phones[phones.length - 1].created_at, 60));
      if (phones.length >= 5) waits.push(remaining(phones[phones.length - 5].created_at, 3600));
      if (ips.length >= 20) waits.push(remaining(ips[ips.length - 20].created_at, 3600));
      const retryAfterSeconds = Math.max(...waits);
      if (retryAfterSeconds > 0) throw new HttpException({ error: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng chờ rồi thử lại.', code: 'INTAKE_RATE_LIMIT', retryAfterSeconds }, 429);
      const id = crypto.randomUUID();
      await client.query(`INSERT INTO intake_requests (id, kind, name, phone, need, request_key_hash, payload_hash, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`, [id, input.kind, input.name, phone, input.need, keyHash, payloadHash, now]);
      await client.query('INSERT INTO intake_rate_events (phone_hash, ip_hash, created_at) VALUES ($1,$2,$3)', [phoneHash, ipHash, now]);
      await client.query("DELETE FROM intake_rate_events WHERE created_at <= $1::timestamptz - INTERVAL '1 hour'", [now]);
      return { success: true as const, receiptId: id };
    });
  }

  async list(query: IntakeListQuery) {
    const values: unknown[] = [];
    const conditions: string[] = [];
    for (const column of ['kind', 'status'] as const) if (query[column]) {
      values.push(query[column]); conditions.push(`${column} = $${values.length}`);
    }
    if (query.search) {
      values.push(`%${query.search.replace(/[\\%_]/g, '\\$&')}%`);
      conditions.push(`(name ILIKE $${values.length} OR phone ILIKE $${values.length} OR need ILIKE $${values.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const order = query.order === 'asc' ? 'ASC' : 'DESC';
    const sort = query.sort === 'updatedAt' ? 'updated_at' : 'created_at';
    // Count and page share one snapshot, including an empty out-of-range page.
    const result = await this.db.query(`WITH matched AS (SELECT ${fields} FROM intake_requests ${where}),
      page AS (SELECT * FROM matched ORDER BY "${sort === 'updated_at' ? 'updatedAt' : 'createdAt'}" ${order}, id ${order} LIMIT $${values.length + 1} OFFSET $${values.length + 2})
      SELECT (SELECT count(*)::int FROM matched) AS total, COALESCE((SELECT json_agg(page) FROM page), '[]'::json) AS items`,
    [...values, query.pageSize, (query.page - 1) * query.pageSize]);
    const { total, items } = result.rows[0];
    return { items: items.map(summary), pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  async detail(id: string) {
    const result = await this.db.query(`SELECT ${fields} FROM intake_requests WHERE id = $1`, [id]);
    if (!result.rows[0]) throw new NotFoundException({ error: 'Không tìm thấy yêu cầu.' });
    return summary(result.rows[0]);
  }

  async history(id: string, query: { page: number; pageSize: number }) {
    await this.detail(id);
    const result = await this.db.query(`WITH matched AS (
      SELECT id, actor_name AS "actorName", from_status AS "fromStatus", to_status AS "toStatus", note, revision,
        created_at AS "createdAt" FROM intake_history WHERE request_id=$1
      ), page AS (SELECT * FROM matched ORDER BY revision DESC LIMIT $2 OFFSET $3)
      SELECT (SELECT count(*)::int FROM matched) AS total, COALESCE((SELECT json_agg(page) FROM page),'[]'::json) AS items`,
    [id, query.pageSize, (query.page-1)*query.pageSize]);
    const { items, total } = result.rows[0];
    return { items: items.map((row: Record<string, unknown>) => ({ ...row, createdAt: new Date(row.createdAt as string).toISOString() })),
      pagination: { ...query, total, totalPages: Math.ceil(total/query.pageSize) } };
  }

  async update(id: string, input: IntakeUpdate, actor: AppIdentity) {
    return this.db.transaction(async client => {
      // Same authority lock used by user/role administration, before the request row lock.
      await client.query('SELECT pg_advisory_xact_lock(74120, 1)');
      const { rows: [currentActor] } = await client.query('SELECT role_code,status,name,email FROM users WHERE id=$1', [actor.id]);
      if (!currentActor || !['admin','superadmin'].includes(currentActor.role_code)
        || !['hoạt động','active','approved','enabled'].includes(currentActor.status.trim().toLowerCase())) {
        throw new ForbiddenException({ error: 'Bạn không có quyền xử lý yêu cầu.' });
      }
      const { rows: [record] } = await client.query(`SELECT ${fields} FROM intake_requests WHERE id=$1 FOR UPDATE`, [id]);
      if (!record) throw new NotFoundException({ error: 'Không tìm thấy yêu cầu.' });
      if (record.revision !== input.expectedRevision) throw new ConflictException({ code: 'INTAKE_CHANGED', error: 'Yêu cầu đã được cập nhật. Vui lòng tải lại trước khi lưu.' });
      const current = summary(record);
      if (input.status !== current.status && !intakeTransitions[current.status].includes(input.status)) {
        throw new BadRequestException({ error: 'Không thể chuyển sang trạng thái này.' });
      }
      if (input.status === current.status && !input.note) throw new BadRequestException({ error: 'Nhập ghi chú hoặc chọn trạng thái mới.' });
      const updated = await client.query(`UPDATE intake_requests SET status=$2, revision=revision+1, updated_at=clock_timestamp()
        WHERE id=$1 RETURNING ${fields}`, [id,input.status]);
      const saved = summary(updated.rows[0]);
      const eventId = crypto.randomUUID();
      await client.query(`INSERT INTO intake_history (id,request_id,actor_id,actor_name,from_status,to_status,note,revision,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [eventId,id,actor.id,currentActor.name,current.status,saved.status,input.note,saved.revision,saved.updatedAt]);
      await client.query(`INSERT INTO audit_logs (id,user_id,user_name,user_email,action,entity_type,entity_id,summary,metadata)
        VALUES ($1,$2,$3,$4,'UPDATE','intake_request',$5,'Cập nhật yêu cầu tư vấn/hợp tác.',$6::jsonb)`,
      [`LOG-${crypto.randomUUID()}`,actor.id,currentActor.name,currentActor.email,id,JSON.stringify({fromStatus:current.status,toStatus:saved.status,revision:saved.revision,eventId})]);
      return saved;
    });
  }
}
