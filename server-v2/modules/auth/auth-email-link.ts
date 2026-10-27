import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import crypto from 'node:crypto';
import { PostgresService } from '../../database/postgres.service.js';

export function authEmailPageUrl(path: '/dat-lai-mat-khau' | '/xac-thuc-email') {
  try {
    const url = new URL(String(process.env.PUBLIC_APP_URL || ''));
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:' && process.env.NODE_ENV !== 'production'))
      || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('origin');
    return new URL(path, url.origin);
  } catch {
    throw new ServiceUnavailableException({ success: false, error: 'Chức năng gửi email chưa sẵn sàng. Vui lòng thử lại sau hoặc liên hệ quản trị viên.' });
  }
}

/** Shared persistent auth-email counters. Namespaced HMAC keys contain no cleartext contacts. */
export async function limitAuthEmail(db: PostgresService, scope: string, value: string, maximum: number, cooldown: number) {
  const key = crypto.createHmac('sha256', String(process.env.JWT_REFRESH_SECRET || ''))
    .update(`${scope}:${value}`).digest('hex');
  const result = await db.query(`
    INSERT INTO password_reset_limits AS current (key_hash, hits, window_started_at, last_allowed_at)
    VALUES ($1,1,NOW(),NOW())
    ON CONFLICT (key_hash) DO UPDATE SET
      hits = CASE WHEN current.window_started_at <= NOW() - INTERVAL '1 hour' THEN 1 ELSE current.hits + 1 END,
      last_allowed_at = NOW(),
      window_started_at = CASE WHEN current.window_started_at <= NOW() - INTERVAL '1 hour' THEN NOW() ELSE current.window_started_at END
    WHERE current.window_started_at <= NOW() - INTERVAL '1 hour'
      OR (current.hits < $2 AND current.last_allowed_at <= NOW() - $3 * INTERVAL '1 second')
    RETURNING key_hash
  `, [key, maximum, cooldown]);
  if (!result.rowCount) {
    const retry = await db.query<{ seconds: number }>(`SELECT GREATEST(1, CEIL(EXTRACT(EPOCH FROM
      CASE WHEN hits >= $2 THEN window_started_at + INTERVAL '1 hour'
      ELSE last_allowed_at + $3 * INTERVAL '1 second' END - NOW())))::int AS seconds
      FROM password_reset_limits WHERE key_hash = $1`, [key, maximum, cooldown]);
    throw new HttpException({ success: false, error: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng chờ rồi thử lại.',
      retryAfterSeconds: retry.rows[0]?.seconds || 60 }, 429);
  }
}
