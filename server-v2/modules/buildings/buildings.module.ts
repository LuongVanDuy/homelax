import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AmenitiesModule } from '../amenities/amenities.module.js';
import { BuildingsController } from './buildings.controller.js';
import { BuildingsService } from './buildings.service.js';

@Module({
  imports: [AuditModule, AmenitiesModule],
  controllers: [BuildingsController],
  providers: [BuildingsService],
  exports: [BuildingsService],
})
export class BuildingsModule {}
