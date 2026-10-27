import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { RoomTypeCatalogController } from './room-type-catalog.controller.js';
import { RoomTypeCatalogService } from './room-type-catalog.service.js';

@Module({
  imports: [AuditModule],
  controllers: [RoomTypeCatalogController],
  providers: [RoomTypeCatalogService],
  exports: [RoomTypeCatalogService],
})
export class RoomTypeCatalogModule {}
