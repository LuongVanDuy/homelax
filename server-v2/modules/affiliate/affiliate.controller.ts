import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  affiliateReferralSchema,
  ctvMyCustomersQuerySchema,
  ctvMyCustomersWorkspaceSchema,
  type CtvMyCustomersQuery,
} from '@tinyhouse/contracts';
import { Roles } from '../../common/auth/auth.decorators.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AppIdentity } from '../../common/auth/auth.types.js';
import {
  ApiStandardErrors,
  ApiZodOk,
} from '../../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AffiliateService } from './affiliate.service.js';

@ApiTags('affiliate')
@ApiBearerAuth()
@ApiStandardErrors()
@Controller('affiliate')
export class AffiliateController {
  constructor(private readonly affiliate: AffiliateService) {}

  @Get('me')
  @Roles('ctv_sale')
  @ApiOperation({ summary: 'Get the stable affiliate token for the authenticated CTV profile' })
  @ApiZodOk(affiliateReferralSchema, 'Current CTV affiliate referral')
  mine(@CurrentUser() actor: AppIdentity) {
    return this.affiliate.mine(actor);
  }

  @Get('me/customers')
  @Roles('ctv_sale')
  @ApiOperation({
    summary: 'U07.6 strict-self CTV customer journey, deal and commission read model',
  })
  @ApiZodOk(ctvMyCustomersWorkspaceSchema, 'Current CTV customer workspace')
  myCustomers(
    @Query(new ZodValidationPipe(ctvMyCustomersQuerySchema)) query: CtvMyCustomersQuery,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.affiliate.myCustomers(actor, query);
  }
}
