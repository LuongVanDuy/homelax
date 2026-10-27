import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AmenitiesController } from './amenities.controller.js';
import { AmenitiesService } from './amenities.service.js';

@Module({
  imports: [AuditModule],
  controllers: [AmenitiesController],
  providers: [AmenitiesService],
  exports: [AmenitiesService],
})
export class AmenitiesModule {}
