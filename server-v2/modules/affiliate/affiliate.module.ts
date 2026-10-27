import { Module } from '@nestjs/common';
import { AffiliateController } from './affiliate.controller.js';
import { AffiliateService } from './affiliate.service.js';

@Module({
  controllers: [AffiliateController],
  providers: [AffiliateService],
  exports: [AffiliateService],
})
export class AffiliateModule {}
