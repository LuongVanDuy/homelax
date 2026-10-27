import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DATABASE_MIGRATIONS, type DatabaseMigration } from './migrations.js';

/** Runs inside the caller's transaction, before the application accepts requests. */
export async function runDatabaseMigrations(
  client: PoolClient,
  migrations: readonly DatabaseMigration[] = DATABASE_MIGRATIONS,
) {
  await client.query('SELECT pg_advisory_xact_lock(74120, 2)');
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const applied = await client.query<{ id: string; checksum: string }>(
    'SELECT id, checksum FROM schema_migrations',
  );
  const known = new Map(applied.rows.map((row) => [row.id, row.checksum]));
  const ids = new Set<string>();

  for (const migration of migrations) {
    if (ids.has(migration.id)) {
      throw new Error(`Duplicate database migration: ${migration.id}.`);
    }
    ids.add(migration.id);

    const checksum = createHash('sha256').update(migration.sql).digest('hex');
    if (known.has(migration.id)) {
      if (known.get(migration.id) !== checksum) {
        throw new Error(`Applied database migration changed: ${migration.id}. Add a new migration instead.`);
      }
      continue;
    }

    await client.query(migration.sql);
    await client.query(
      'INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)',
      [migration.id, checksum],
    );
  }
}
