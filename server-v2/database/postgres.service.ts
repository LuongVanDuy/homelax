import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import pg, {
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from 'pg';
import { getRequiredEnv } from '../config/environment.js';
import { runDatabaseMigrations } from './run-migrations.js';

const { Pool } = pg;

@Injectable()
export class PostgresService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: getRequiredEnv('DATABASE_URL'),
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  async onModuleInit() {
    await this.transaction(runDatabaseMigrations);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async transaction<T>(
    operation: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async health() {
    const started = Date.now();
    const result = await this.pool.query<{
      database: string;
      version: string;
    }>(
      `
        SELECT
          current_database() AS database,
          current_setting('server_version') AS version
      `,
    );

    return {
      ok: true,
      latencyMs: Date.now() - started,
      database: result.rows[0]?.database || '',
      version: result.rows[0]?.version || '',
    };
  }
}
