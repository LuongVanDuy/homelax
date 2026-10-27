import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';
import {
  auditCreateRequestSchema,
  auditListQuerySchema,
  auditPageSchema,
  type AuditCreateRequest,
  type AuditListQuery,
} from '@tinyhouse/contracts';
import {
  CmsScreen,
} from '../../common/auth/auth.decorators.js';
import type {
  RequestWithIdentity,
} from '../../common/auth/auth.types.js';
import {
  ZodValidationPipe,
} from '../../common/pipes/zod-validation.pipe.js';
import {
  ApiStandardErrors,
  ApiZodBody,
  ApiZodOk,
} from '../../common/openapi/zod-openapi.js';
import {
  AuditService,
} from './audit.service.js';

@ApiTags('audit')
@ApiBearerAuth()
@ApiStandardErrors()
@Controller('audit-logs')
export class AuditController {
  constructor(
    private readonly auditService:
      AuditService,
  ) {}

  @Get()
  @CmsScreen('auditlog')
  @ApiZodOk(auditPageSchema, 'Paged audit logs')
  list(
    @Query(new ZodValidationPipe(auditListQuerySchema))
    query: AuditListQuery,
  ) {
    return this.auditService.list(query);
  }

  @Post()
  @HttpCode(201)
  @ApiZodBody(
    auditCreateRequestSchema,
  )
  create(
    @Body(
      new ZodValidationPipe(
        auditCreateRequestSchema,
      ),
    )
    body: AuditCreateRequest,
    @Req()
    request: RequestWithIdentity,
  ) {
    return this.auditService.create({
      ...body,
      user: request.user,
    });
  }
}
