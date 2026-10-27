import { Body, Controller, Get, HttpCode, HttpException, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiQuery, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { intakeCreateSchema, intakeListQuerySchema, intakePageSchema, intakeReceiptSchema, intakeSummarySchema, type IntakeCreate, type IntakeListQuery } from '@tinyhouse/contracts';
import { Public, Roles } from '../../common/auth/auth.decorators.js';
import { ApiStandardErrors, ApiZodBody, ApiZodOk } from '../../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { IntakeService } from './intake.service.js';
import { intakeUpdateSchema, intakeHistoryPageSchema, intakeHistoryQuerySchema, type IntakeUpdate } from '@tinyhouse/contracts';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AppIdentity } from '../../common/auth/auth.types.js';

@ApiTags('intake')
@ApiStandardErrors()
@Controller('public/intake')
export class PublicIntakeController {
  constructor(private readonly intake: IntakeService) {}
  @Post()
  @Public()
  @HttpCode(200)
  @ApiZodBody(intakeCreateSchema)
  @ApiZodOk(intakeReceiptSchema, 'Safe receipt; the same requestKey and payload return the same receipt')
  @ApiConflictResponse({ description: 'requestKey was already used with a different normalized payload.' })
  @ApiTooManyRequestsResponse({ description: 'Rolling phone/IP limit exceeded; Retry-After header and retryAfterSeconds specify when to retry.' })
  async create(@Body(new ZodValidationPipe(intakeCreateSchema)) body: IntakeCreate,
    @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    try { return await this.intake.create(body, request.ip || request.socket.remoteAddress || 'unknown'); }
    catch (error) {
      if (error instanceof HttpException && error.getStatus() === 429) {
        const value = error.getResponse() as { retryAfterSeconds: number };
        response.setHeader('Retry-After', String(value.retryAfterSeconds));
      }
      throw error;
    }
  }
}

@ApiTags('intake')
@ApiBearerAuth()
@ApiStandardErrors()
@Roles('admin', 'superadmin')
@Controller('intake-requests')
export class IntakeAdminController {
  constructor(private readonly intake: IntakeService) {}
  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'kind', required: false, enum: ['landlord_consultation', 'collaborator_registration', 'collaborator_consultation', 'general_contact'] })
  @ApiQuery({ name: 'status', required: false, enum: ['new', 'processing', 'completed', 'rejected', 'spam'] })
  @ApiQuery({ name: 'sort', required: false, enum: ['createdAt', 'updatedAt'] })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiZodOk(intakePageSchema)
  list(@Query(new ZodValidationPipe(intakeListQuerySchema)) query: IntakeListQuery, @Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    return this.intake.list(query);
  }
  @Get(':id')
  @ApiZodOk(intakeSummarySchema)
  detail(@Param('id', new ParseUUIDPipe()) id: string, @Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    return this.intake.detail(id);
  }
  @Get(':id/history')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiZodOk(intakeHistoryPageSchema)
  history(@Param('id', new ParseUUIDPipe()) id: string,
    @Query(new ZodValidationPipe(intakeHistoryQuerySchema)) query: { page: number; pageSize: number }) {
    return this.intake.history(id, query);
  }
  @Patch(':id')
  @ApiZodBody(intakeUpdateSchema)
  @ApiZodOk(intakeSummarySchema)
  @ApiConflictResponse({ description: 'The request changed; reload the current revision before saving.' })
  update(@Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(intakeUpdateSchema)) body: IntakeUpdate, @CurrentUser() actor: AppIdentity) {
    return this.intake.update(id,body,actor);
  }
}
