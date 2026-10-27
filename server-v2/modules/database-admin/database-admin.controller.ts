import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';
import {
  databaseRestoreRequestSchema,
  databaseRestoreResponseSchema,
  databaseSnapshotSchema,
  databaseStatsSchema,
  type DatabaseRestoreRequest,
} from '@tinyhouse/contracts';
import {
  CmsScreen,
  Roles,
} from '../../common/auth/auth.decorators.js';
import {
  ApiStandardErrors,
  ApiZodBody,
  ApiZodOk,
} from '../../common/openapi/zod-openapi.js';
import {
  ZodValidationPipe,
} from '../../common/pipes/zod-validation.pipe.js';
import {
  DatabaseAdminService,
} from './database-admin.service.js';

@ApiTags('database')
@ApiBearerAuth()
@ApiStandardErrors()
@CmsScreen('database')
@Roles('admin', 'superadmin')
@Controller('database')
export class DatabaseAdminController {
  constructor(
    private readonly service:
      DatabaseAdminService,
  ) {}

  @Get('stats')
  @ApiZodOk(databaseStatsSchema, 'Live PostgreSQL counts and snapshot version')
  stats() {
    return this.service.stats();
  }

  @Post('backup')
  @HttpCode(200)
  @ApiZodOk(databaseSnapshotSchema, 'Sensitive full snapshot including its metadata')
  backup() {
    return this.service.backup();
  }

  @Post('restore')
  @HttpCode(200)
  @ApiZodBody(
    databaseRestoreRequestSchema,
  )
  @ApiZodOk(databaseRestoreResponseSchema, 'Dry-run preview or committed restore result')
  restore(
    @Body(
      new ZodValidationPipe(
        databaseRestoreRequestSchema,
      ),
    )
    body: DatabaseRestoreRequest,
  ) {
    return this.service.restore(
      body.snapshot,
      body.dryRun,
    );
  }
}
