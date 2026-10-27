import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { CommissionConfigController } from './commission-config.controller.js';
import { CommissionConfigService } from './commission-config.service.js';

@Module({
  imports: [AuditModule],
  controllers: [CommissionConfigController],
  providers: [CommissionConfigService],
})
export class CommissionConfigModule {}
