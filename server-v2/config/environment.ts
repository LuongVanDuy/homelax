import dotenv from 'dotenv';
import path from 'path';

dotenv.config({
  path: path.resolve(
    process.cwd(),
    '.env',
  ),
  override: false,
});

export function getRequiredEnv(
  name: string,
) {
  const value = String(
    process.env[name] || '',
  ).trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
}
