import { Injectable } from '@nestjs/common';
import { PostgresService } from '../../database/postgres.service.js';
import {
  getSystemDataVersion,
} from '../../common/version/system-version.js';

@Injectable()
export class SystemService {
  constructor(private readonly db: PostgresService) {}

  async health() {
    const database = await this.db.health();

    return {
      status: 'ok',
      architecture:
        'NestJS v2 modular monolith with PostgreSQL',
      database,
      runtime: 'nest-postgresql',
      legacyRuntime: false,
      timestamp: new Date().toISOString(),
    };
  }

  version() {
    return {
      success: true,
      version: getSystemDataVersion(),
    };
  }
}
