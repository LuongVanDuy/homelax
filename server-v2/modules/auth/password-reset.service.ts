import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import { PostgresService } from '../../database/postgres.service.js';
import { EmailService } from '../../common/email/email.service.js';
import { authEmailPageUrl, limitAuthEmail } from './auth-email-link.js';

const MESSAGE = 'Nếu email này có tài khoản, bạn sẽ nhận được link đặt lại mật khẩu. Vui lòng kiểm tra cả thư rác.';
const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  constructor(private readonly db: PostgresService, private readonly email: EmailService) {}

  async requestReset(inputEmail: string, ip: string) {
    // Configuration failures are identical for existing and unknown accounts.
    this.email.assertRecoveryEmailConfigured();
    const url = authEmailPageUrl('/dat-lai-mat-khau');
    const email = inputEmail.trim().toLowerCase();
    await limitAuthEmail(this.db, 'request-ip', ip, 60, 0);
    await limitAuthEmail(this.db, 'request-email', email, 5, 60);
    await this.db.query("DELETE FROM password_reset_limits WHERE window_started_at < NOW() - INTERVAL '2 hours'");
    await this.db.query('DELETE FROM password_reset_tokens WHERE expires_at < NOW()');
    const raw = crypto.randomBytes(48).toString('base64url');
    const tokenHash = hash(raw);
    const recipient = await this.db.transaction(async client => {
      // Same lock order as password changes, login and refresh: user first.
      const result = await client.query<{ id: string; email: string }>(
        'SELECT id, email FROM users WHERE lower(btrim(email)) = $1 AND password_hash IS NOT NULL FOR UPDATE', [email]);
      const user = result.rows[0];
      if (!user) return null;
      await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);
      await client.query(`INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
        VALUES ($1,$2,NOW() + INTERVAL '30 minutes')`, [tokenHash, user.id]);
      return user.email.trim();
    });
    if (recipient) {
      // Fragment is never sent in page requests/referrers or web access logs.
      url.hash = new URLSearchParams({ token: raw }).toString();
      // Do not await SMTP: response shape/timing must not disclose account existence.
      // Failed deliveries invalidate this token; never log addresses, URLs or SMTP errors.
      void this.email.sendPasswordRecoveryEmail(recipient,
        `Bạn đã yêu cầu đặt lại mật khẩu Homelax.\n\n${url.toString()}\n\nLink dùng một lần, hết hạn sau 30 phút. Link mới nhất thay thế các link trước. Nếu không yêu cầu, bạn có thể bỏ qua email này.`,
      ).catch(async () => {
        await this.db.query('DELETE FROM password_reset_tokens WHERE token_hash = $1', [tokenHash]).catch(() => undefined);
        this.logger.warn('Password recovery email delivery failed. Check SMTP configuration and availability.');
      });
    }
    return { success: true as const, message: MESSAGE, retryAfterSeconds: 60 };
  }

  async resetPassword(token: string, newPassword: string, ip: string) {
    await limitAuthEmail(this.db, 'reset-ip', ip, 60, 0);
    const tokenHash = hash(token);
    const found = await this.db.query<{ user_id: string }>(
      'SELECT user_id FROM password_reset_tokens WHERE token_hash = $1 AND expires_at > NOW()', [tokenHash]);
    const userId = found.rows[0]?.user_id;
    if (!userId) this.invalidLink();
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1,
    });
    await this.db.transaction(async client => {
      const user = await client.query<{ id: string }>('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
      if (!user.rowCount) this.invalidLink();
      const active = await client.query('SELECT token_hash FROM password_reset_tokens WHERE token_hash = $1 AND user_id = $2 AND expires_at > clock_timestamp() FOR UPDATE', [tokenHash, userId]);
      if (!active.rowCount) this.invalidLink();
      // The password-change trigger consumes all reset links for this user.
      await client.query('UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1', [userId, passwordHash]);
      await client.query('UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
      await client.query(`INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, summary)
        VALUES ($1,$2,'SELF_RESET_PASSWORD','user',$2,'Đặt lại mật khẩu qua link email; thu hồi các phiên refresh.')`,
      [`LOG-${crypto.randomUUID()}`, userId]);
    });
    return { success: true as const, message: 'Mật khẩu đã được đặt lại. Vui lòng đăng nhập bằng mật khẩu mới.' };
  }

  private invalidLink(): never {
    throw new BadRequestException({ success: false, error: 'Link khôi phục không hợp lệ, đã dùng hoặc đã hết hạn. Vui lòng yêu cầu link mới.', code: 'RESET_LINK_INVALID' });
  }
}
