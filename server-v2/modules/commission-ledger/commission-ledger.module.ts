import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { CommissionLedgerController } from './commission-ledger.controller.js';
import { CommissionLedgerService } from './commission-ledger.service.js';

@Module({
  imports: [AuditModule],
  controllers: [CommissionLedgerController],
  providers: [CommissionLedgerService],
  exports: [CommissionLedgerService],
})
export class CommissionLedgerModule {}
