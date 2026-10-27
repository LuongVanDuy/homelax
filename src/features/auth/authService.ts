import {
  authSessionResponseSchema,
  loginRequestSchema,
  registerRequestSchema,
  registerResponseSchema,
  updateProfileRequestSchema,
  forgotPasswordRequestSchema,
  forgotPasswordResponseSchema,
  publicResetPasswordRequestSchema,
  resetPasswordResponseSchema,
  requestVerificationResponseSchema,
  verifyEmailRequestSchema,
  verifyEmailResponseSchema,
} from '@tinyhouse/contracts';
import {
  ApiClient,
} from '../../services/apiClient';
import {
  IdentityStore,
  type AppIdentity,
} from './identityStore';

function parseContract<T>(
  schema: {
    safeParse: (
      value: unknown,
    ) => {
      success: boolean;
      data?: T;
      error?: {
        issues?: Array<{
          message?: string;
        }>;
      };
    };
  },
  value: unknown,
): T {
  const parsed =
    schema.safeParse(value);

  if (!parsed.success) {
    const message =
      parsed.error?.issues?.[0]
        ?.message ||
      'Dữ liệu không hợp lệ.';

    throw new Error(message);
  }

  return parsed.data as T;
}

export const AuthService = {
  async requestEmailVerification() {
    return requestVerificationResponseSchema.parse(await ApiClient.post('/v2/auth/email-verification/request', {}));
  },

  async verifyEmail(token: string) {
    return verifyEmailResponseSchema.parse(await ApiClient.post('/v2/auth/email-verification/confirm',
      verifyEmailRequestSchema.parse({ token })));
  },

  async forgotPassword(email: string) {
    return forgotPasswordResponseSchema.parse(await ApiClient.post('/v2/auth/forgot-password',
      forgotPasswordRequestSchema.parse({ email })));
  },

  async resetPassword(token: string, newPassword: string) {
    const result = resetPasswordResponseSchema.parse(await ApiClient.post('/v2/auth/reset-password',
      publicResetPasswordRequestSchema.parse({ token, newPassword })));
    await ApiClient.logoutSession().catch(() => undefined);
    return result;
  },

  getCurrentIdentity():
    AppIdentity {
    return IdentityStore.get();
  },

  subscribe(
    listener: (
      user: AppIdentity,
    ) => void,
  ) {
    return IdentityStore.subscribe(
      listener,
    );
  },

  async getRuntimeState() {
    return ApiClient.get(
      '/v2/auth/runtime',
      {
        bypassCache: true,
      },
    );
  },

  async login(
    identifier: string,
    password: string,
  ) {
    const payload =
      parseContract(
        loginRequestSchema,
        {
          email: String(
            identifier || '',
          ).trim(),
          password,
        },
      );

    return ApiClient.loginSession(payload);
  },

  async register(
    payload:
      Record<string, unknown>,
  ) {
    const validated =
      parseContract(
        registerRequestSchema,
        payload,
      );

    return registerResponseSchema.parse(await ApiClient.post('/v2/auth/register', validated));
  },

  async restoreSession() {
    try {
      await ApiClient.refreshSession();
      return IdentityStore.get();
    } catch (error) {
      const sessionError = error as { status?: number; code?: string };
      if (
        sessionError.status === 401 ||
        sessionError.status === 403 ||
        sessionError.code === 'SESSION_CHANGED'
      ) {
        return IdentityStore.get();
      }

      // A temporarily unreachable server does not prove the session expired.
      throw error;
    }
  },

  async syncIdentity() {
    const current = IdentityStore.get();
    if (!current) return null;
    const version = ApiClient.getSessionVersion();
    try {
      const session = authSessionResponseSchema.parse(
        await ApiClient.get('/v2/auth/session', { bypassCache: true }),
      );
      if (version !== ApiClient.getSessionVersion() || IdentityStore.get()?.id !== current.id || session.user.id !== current.id) {
        return IdentityStore.get();
      }
      if (JSON.stringify(IdentityStore.get()) !== JSON.stringify(session.user)) {
        ApiClient.acceptIdentity(session.user);
      }
      return session.user;
    } catch (error) {
      const failure = error as { status?: number };
      // A session endpoint denial means the account itself is no longer active.
      if (version === ApiClient.getSessionVersion() && IdentityStore.get()?.id === current.id && (failure.status === 401 || failure.status === 403)) {
        ApiClient.removeToken();
      }
      throw error;
    }
  },

  async signInWithGoogle() {
    throw new Error(
      'Google OAuth chưa được cấu hình sau khi chuyển sang PostgreSQL Auth. Vui lòng đăng nhập bằng email/mật khẩu.',
    );
  },

  async updateProfile(
    payload: {
      name?: string;
      currentPassword?: string;
      newPassword?: string;
    },
  ) {
    const validated =
      parseContract(
        updateProfileRequestSchema,
        payload,
      );

    const version = ApiClient.getSessionVersion();
    const result =
      await ApiClient.post(
        '/v2/auth/update-profile',
        validated,
      );

    if (result?.user && version === ApiClient.getSessionVersion()) {
      IdentityStore.set(
        result.user,
      );
    }

    return result;
  },

  async logout() {
    return ApiClient.logoutSession();
  },
};

export default AuthService;
