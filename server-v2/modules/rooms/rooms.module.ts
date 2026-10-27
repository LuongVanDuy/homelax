import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AmenitiesModule } from '../amenities/amenities.module.js';
import { BuildingsModule } from '../buildings/buildings.module.js';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';

@Module({
  imports: [BuildingsModule, AuditModule, AmenitiesModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
