import { Module } from '@nestjs/common';
import { EmailModule } from '../../common/email/email.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AffiliateModule } from '../affiliate/affiliate.module.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';

@Module({
  imports: [AuditModule, EmailModule, AffiliateModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
