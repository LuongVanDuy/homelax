import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { registerRequestSchema, normalizeAccountPhone, updateProfileRequestSchema, type RegisterRequest, type UpdateProfileRequest } from '@tinyhouse/contracts';
import argon2 from 'argon2';
import crypto from 'crypto';
import type { PoolClient, QueryResultRow } from 'pg';
import { PostgresService } from '../../database/postgres.service.js';
import {
  getAuthRuntimeConfig,
} from '../../config/auth-config.js';
import type {
  AppIdentity,
  AccessTokenPayload,
} from '../../common/auth/auth.types.js';
import { AuthIdentityService } from '../../common/auth/auth-identity.service.js';

import { rethrowAccountContactError } from '../../common/auth/account-contact-error.js';
import { prepareRegistrationAvatar } from './register-avatar.js';

type LoginRow = QueryResultRow & {
  id: string;
  password_hash: string | null;
};

type RefreshRow = QueryResultRow & {
  id: string;
  user_id: string;
};

function refreshHash(token: string) {
  return crypto
    .createHmac(
      'sha256',
      String(process.env.JWT_REFRESH_SECRET || ''),
    )
    .update(token)
    .digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: PostgresService,
    private readonly jwt: JwtService,
    private readonly identity: AuthIdentityService,
  ) {}

  runtime() {
    return this.identity.runtimeState();
  }

  private async accessToken(userId: string) {
    const config = getAuthRuntimeConfig();
    const payload: AccessTokenPayload = {
      sub: userId,
      type: 'access',
    };

    return this.jwt.signAsync(payload, {
      expiresIn: config.accessTtl as any,
    });
  }

  private async issueRefreshToken(userId: string, client: PoolClient) {
    const config = getAuthRuntimeConfig();
    const raw = crypto.randomBytes(48).toString('base64url');
    const hash = refreshHash(raw);
    const id = `rt_${crypto.randomUUID()}`;
    const expiresAt = new Date(
      Date.now() +
        config.refreshTtlDays * 24 * 60 * 60 * 1000,
    );

    await client.query(
      `
        INSERT INTO refresh_tokens (
          id, user_id, token_hash, expires_at
        ) VALUES ($1,$2,$3,$4)
      `,
      [id, userId, hash, expiresAt.toISOString()],
    );

    return {
      raw,
      expiresAt,
    };
  }

  private async sessionForUser(userId: string, proof: { passwordHash?: string; refreshHash?: string } = {}) {
    return this.db.transaction(async client => {
      // Serialize credential checks and successor issuance with password reset.
      const current = await client.query<{ password_hash: string | null }>(
        'SELECT password_hash FROM users WHERE id = $1 FOR UPDATE', [userId]);
      if (!current.rowCount || (proof.passwordHash !== undefined && current.rows[0].password_hash !== proof.passwordHash)) {
        throw new UnauthorizedException({ success: false, error: 'Thông tin đăng nhập đã thay đổi. Vui lòng đăng nhập lại.' });
      }
      if (proof.refreshHash) {
        const refresh = await client.query<RefreshRow>(`SELECT id, user_id FROM refresh_tokens
          WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL AND expires_at > NOW() FOR UPDATE`,
        [userId, proof.refreshHash]);
        if (!refresh.rowCount) throw new UnauthorizedException({ success: false, error: 'Refresh session không hợp lệ hoặc đã hết hạn.' });
        await client.query('UPDATE refresh_tokens SET revoked_at = NOW(), last_used_at = NOW() WHERE id = $1', [refresh.rows[0].id]);
      }
      const identity = this.identity.assertActive(await this.identity.identityByUserId(userId, 'postgres', client));
      const [accessToken, refresh] = await Promise.all([
        this.accessToken(userId), this.issueRefreshToken(userId, client),
      ]);
      return { success: true, authMode: 'postgres', accessToken,
        refreshToken: refresh.raw, refreshExpiresAt: refresh.expiresAt, user: identity };
    });
  }

  async login(identifier: string, password: string) {
    const clean = String(identifier || '')
      .trim()
      .toLowerCase();

    const result = await this.db.query<LoginRow>(
      `
        SELECT id, password_hash
        FROM users
        WHERE lower(email) = $1
           OR phone = $2
        LIMIT 1
      `,
      [clean, String(identifier || '').trim()],
    );

    const row = result.rows[0];

    if (
      !row?.password_hash ||
      !(await argon2.verify(row.password_hash, password))
    ) {
      throw new UnauthorizedException({
        success: false,
        error: 'Email/số điện thoại hoặc mật khẩu không chính xác.',
      });
    }

    return this.sessionForUser(row.id, { passwordHash: row.password_hash });
  }

  async register(input: RegisterRequest) {
    const parsed = registerRequestSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException({ success: false, error: 'Thông tin đăng ký không hợp lệ.' });
    const data = parsed.data;
    const id = `usr_${crypto.randomUUID()}`;
    const passwordHash = await argon2.hash(data.password, {
      type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1,
    });
    const avatar = await prepareRegistrationAvatar(data.avatarImage);
    try {
      await this.db.query(`
        INSERT INTO users (
          id, name, email, phone, password_hash, role_code, role_name, status,
          auth_provider, gender, birth_date, address, avatar
        ) VALUES ($1,$2,$3,$4,$5,'customer','Khách hàng','Hoạt động','local',$6,$7::date,$8,$9)
      `, [id, data.name, data.email.toLowerCase(), normalizeAccountPhone(data.phone), passwordHash,
        data.gender ?? null, data.birthDate ?? null, data.address ?? '', avatar?.url ?? '']);
    } catch (error) {
      if (avatar) await avatar.discard().catch(() => undefined);
      rethrowAccountContactError(error);
    }
    // Registration never creates a CRM profile, links old bookings or grants CTV access.
    return { success: true, user: await this.identity.identityByUserId(id) };
  }

  async refresh(rawRefreshToken: string) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException({
        success: false,
        error: 'Refresh session không tồn tại.',
      });
    }

    const hash = refreshHash(rawRefreshToken);

    const result = await this.db.query<RefreshRow>(
      'SELECT id, user_id FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()', [hash]);
    if (!result.rowCount) throw new UnauthorizedException({ success: false, error: 'Refresh session không hợp lệ hoặc đã hết hạn.' });
    return this.sessionForUser(result.rows[0].user_id, { refreshHash: hash });
  }

  async logout(rawRefreshToken?: string) {
    if (rawRefreshToken) {
      await this.db.query(
        `
          UPDATE refresh_tokens
          SET revoked_at = COALESCE(revoked_at, NOW())
          WHERE token_hash = $1
        `,
        [refreshHash(rawRefreshToken)],
      );
    }

    return { success: true };
  }

  session(identity: AppIdentity) {
    return {
      success: true,
      authMode: identity.authMode,
      user: identity,
    };
  }

  async changePassword(
    identity: AppIdentity,
    currentPassword: string | undefined,
    newPassword: string | undefined,
  ) {
    await this.updateProfile(identity, { currentPassword, newPassword });
    return { success: true, message: 'Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại.' };
  }

  async updateProfile(identity: AppIdentity, input: UpdateProfileRequest) {
    const parsed = updateProfileRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({ success: false, error: 'Thông tin hồ sơ không hợp lệ.' });
    }
    const data = parsed.data;
    await this.db.transaction(async (client) => {
      const result = await client.query<{
        id: string; name: string; phone: string | null; status: string; password_hash: string | null;
      }>(
        'SELECT id, name, phone, status, password_hash FROM users WHERE id = $1 FOR UPDATE',
        [identity.id],
      );
      const user = result.rows[0];
      if (!user || !['hoạt động', 'active', 'approved', 'enabled'].includes(user.status.trim().toLowerCase())) {
        throw new ForbiddenException({ success: false, error: 'Tài khoản không còn được phép cập nhật.' });
      }

      // Validate the password before any write, including combined legacy
      // name/password requests. No partial profile update on a failed check.
      let nextHash: string | undefined;
      if (data.newPassword) {
        const valid = Boolean(user.password_hash && data.currentPassword)
          && await argon2.verify(user.password_hash!, data.currentPassword!).catch(() => false);
        if (!valid) {
          // This is a field validation failure, not an expired access session.
          throw new BadRequestException({
            success: false, error: 'Mật khẩu hiện tại không chính xác.',
            details: [{ path: 'currentPassword', message: 'Mật khẩu hiện tại không chính xác.' }],
          });
        }
        nextHash = await argon2.hash(data.newPassword, {
          type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1,
        });
      }

      const columns = {
        name: 'name', phone: 'phone', avatar: 'avatar',
        gender: 'gender', birthDate: 'birth_date', address: 'address',
      } as const;
      const sets: string[] = [];
      const params: unknown[] = [identity.id];
      const changedFields: string[] = [];
      for (const [key, column] of Object.entries(columns)) {
        const value = data[key as keyof typeof columns];
        if (value === undefined) continue;
        params.push(key === 'phone' ? normalizeAccountPhone(String(value ?? '')) : value);
        sets.push(`${column} = $${params.length}${key === 'birthDate' ? '::date' : ''}`);
        changedFields.push(key);
      }
      if (nextHash) {
        params.push(nextHash);
        sets.push(`password_hash = $${params.length}`);
      }
      await client.query(`UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`, params);

      if (data.name !== undefined || data.phone !== undefined) {
        // Profile ID, attribution token, business address and history stay intact.
        await client.query(
          'UPDATE collaborators SET name = $2, phone = $3, updated_at = NOW() WHERE user_id = $1',
          [identity.id, data.name ?? user.name, data.phone === undefined ? user.phone ?? '' : normalizeAccountPhone(data.phone)],
        );
      }
      if (nextHash) {
        await client.query(
          `UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW())
           WHERE user_id = $1 AND revoked_at IS NULL`,
          [identity.id],
        );
      }
      await client.query(
        `INSERT INTO audit_logs (
          id, user_id, user_name, user_email, action, entity_type, entity_id, summary, metadata
         ) VALUES ($1,$2,$3,$4,$5,'user',$2,$6,$7::jsonb)`,
        [
          `LOG-${crypto.randomUUID()}`, identity.id, identity.name, identity.email,
          nextHash ? 'CHANGE_PASSWORD' : 'UPDATE_PROFILE',
          nextHash ? 'Cập nhật bảo mật tài khoản cá nhân.' : 'Cập nhật hồ sơ cá nhân.',
          JSON.stringify({ changedFields, passwordChanged: Boolean(nextHash) }),
        ],
      );
    }).catch(rethrowAccountContactError);

    return { success: true, user: await this.identity.identityByUserId(identity.id) };
  }

  google() {
    throw new GoneException({
      success: false,
      error:
        'Google OAuth chưa được cấu hình trong auth PostgreSQL. Hãy dùng email/password trong giai đoạn này.',
    });
  }
}
