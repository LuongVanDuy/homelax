import { BadRequestException, ForbiddenException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import crypto from 'node:crypto';
import { PostgresService } from '../../database/postgres.service.js';
import { EmailService } from '../../common/email/email.service.js';
import { authEmailPageUrl, limitAuthEmail } from './auth-email-link.js';

const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);
  constructor(private readonly db: PostgresService, private readonly email: EmailService) {}

  async requestVerification(userId: string, ip: string) {
    this.email.assertRecoveryEmailConfigured();
    const url = authEmailPageUrl('/xac-thuc-email');
    await limitAuthEmail(this.db, 'verify-request-ip', ip, 60, 0);
    await limitAuthEmail(this.db, 'verify-request-user', userId, 5, 60);
    await this.db.query("DELETE FROM password_reset_limits WHERE window_started_at < NOW() - INTERVAL '2 hours'");
    await this.db.query('DELETE FROM email_verification_tokens WHERE expires_at < NOW()');
    const raw = crypto.randomBytes(48).toString('base64url');
    const tokenHash = digest(raw);
    const recipient = await this.db.transaction(async client => {
      const result = await client.query<{ email: string; email_verified_at: Date | null; status: string }>(
        'SELECT email, email_verified_at, status FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const user = result.rows[0];
      if (!user || !['hoạt động', 'active', 'approved', 'enabled'].includes(user.status.trim().toLowerCase())) {
        throw new ForbiddenException({ success: false, error: 'Tài khoản không còn được phép gửi xác thực.' });
      }
      if (user.email_verified_at) return null;
      await client.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);
      await client.query(`INSERT INTO email_verification_tokens (token_hash, user_id, email, expires_at)
        VALUES ($1,$2,$3,NOW() + INTERVAL '30 minutes')`, [tokenHash, userId, user.email.trim().toLowerCase()]);
      return user.email.trim();
    });
    if (!recipient) return { success: true as const, message: 'Email đã được xác thực.', retryAfterSeconds: 0 };
    url.hash = new URLSearchParams({ token: raw }).toString();
    try {
      await this.email.sendVerificationEmail(recipient,
        `Bạn đã yêu cầu xác thực email tài khoản Homelax.\n\n${url}\n\nLink dùng một lần, hết hạn sau 30 phút. Link mới nhất thay thế các link trước. Xác thực email là tự nguyện và không thay đổi quyền tài khoản. Nếu không yêu cầu, bạn có thể bỏ qua email này.`);
    } catch {
      await this.db.query('DELETE FROM email_verification_tokens WHERE token_hash = $1', [tokenHash]).catch(() => undefined);
      this.logger.warn('Email verification delivery failed. Check SMTP configuration and availability.');
      throw new ServiceUnavailableException({ success: false, error: 'Chưa gửi được email xác thực. Vui lòng thử lại sau.', retryAfterSeconds: 60 });
    }
    return { success: true as const, message: 'Đã gửi liên kết xác thực. Vui lòng kiểm tra hộp thư và thư rác.', retryAfterSeconds: 60 };
  }

  async verify(token: string, ip: string) {
    await limitAuthEmail(this.db, 'verify-confirm-ip', ip, 60, 0);
    const tokenHash = digest(token);
    const found = await this.db.query<{ user_id: string }>(
      'SELECT user_id FROM email_verification_tokens WHERE token_hash = $1 AND expires_at > NOW()', [tokenHash]);
    const userId = found.rows[0]?.user_id;
    if (!userId) this.invalidLink();
    await this.db.transaction(async client => {
      const user = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
      if (!user.rowCount) this.invalidLink();
      const current = await client.query(`SELECT t.token_hash FROM email_verification_tokens t JOIN users u ON u.id = t.user_id
        WHERE t.token_hash = $1 AND t.user_id = $2 AND t.expires_at > clock_timestamp()
          AND t.email = lower(btrim(u.email)) FOR UPDATE OF t`, [tokenHash, userId]);
      if (!current.rowCount) this.invalidLink();
      await client.query('UPDATE users SET email_verified_at = NOW(), updated_at = NOW() WHERE id = $1', [userId]);
      await client.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);
      await client.query(`INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, summary)
        VALUES ($1,$2,'SELF_VERIFY_EMAIL','user',$2,'Xác thực email bằng liên kết một lần; giữ nguyên quyền và trạng thái tài khoản.')`,
      [`LOG-${crypto.randomUUID()}`, userId]);
    });
    return { success: true as const, message: 'Email đã được xác thực thành công.' };
  }

  private invalidLink(): never {
    throw new BadRequestException({ success: false, error: 'Liên kết xác thực không hợp lệ, đã dùng hoặc hết hạn. Vui lòng gửi lại từ hồ sơ cá nhân.', code: 'VERIFY_LINK_INVALID' });
  }
}
