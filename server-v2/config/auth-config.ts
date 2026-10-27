import './environment.js';

export type AuthRuntimeConfig = {
  mode: 'postgres';
  databaseConfigured: boolean;
  accessSecretConfigured: boolean;
  refreshSecretConfigured: boolean;
  accessTtl: string;
  refreshTtlDays: number;
};

export function getAuthRuntimeConfig(): AuthRuntimeConfig {
  return {
    mode: 'postgres',
    databaseConfigured: Boolean(String(process.env.DATABASE_URL || '').trim()),
    accessSecretConfigured:
      String(process.env.JWT_ACCESS_SECRET || '').trim().length >= 32,
    refreshSecretConfigured:
      String(process.env.JWT_REFRESH_SECRET || '').trim().length >= 32,
    accessTtl: String(process.env.JWT_ACCESS_TTL || '15m'),
    refreshTtlDays: Math.max(
      1,
      Number(process.env.JWT_REFRESH_TTL_DAYS || 30),
    ),
  };
}
