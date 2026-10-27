import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { CommissionLedgerModule } from '../commission-ledger/commission-ledger.module.js';
import { DealsController } from './deals.controller.js';
import { DealsService } from './deals.service.js';

@Module({
  imports: [AuditModule, CommissionLedgerModule],
  controllers: [DealsController],
  providers: [DealsService],
})
export class DealsModule {}
