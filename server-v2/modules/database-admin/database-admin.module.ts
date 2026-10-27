import { Module } from '@nestjs/common';
import {
  DatabaseAdminController,
} from './database-admin.controller.js';
import {
  DatabaseAdminService,
} from './database-admin.service.js';

@Module({
  controllers: [
    DatabaseAdminController,
  ],
  providers: [
    DatabaseAdminService,
  ],
})
export class DatabaseAdminModule {}
