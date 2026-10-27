import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  collaboratorTypeAssignmentSchema,
  collaboratorTypeListSchema,
  collaboratorTypeSummarySchema,
  collaboratorTypeWriteSchema,
  commissionAllocationStatusSchema,
  commissionAllocationTargetListSchema,
  commissionAllocationTargetSummarySchema,
  commissionAllocationTargetWriteSchema,
  commissionCollaboratorListSchema,
  commissionCollaboratorSummarySchema,
  commissionConfigBoundarySchema,
  type CollaboratorTypeAssignment,
  type CollaboratorTypeWrite,
  type CommissionAllocationTargetWrite,
} from '@tinyhouse/contracts';
import { Roles } from '../../common/auth/auth.decorators.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AppIdentity } from '../../common/auth/auth.types.js';
import { ApiStandardErrors, ApiZodBody, ApiZodOk } from '../../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CommissionConfigService } from './commission-config.service.js';

@ApiTags('commission-config')
@ApiBearerAuth()
@ApiStandardErrors()
@Roles('admin', 'superadmin')
@Controller('commission-config')
export class CommissionConfigController {
  constructor(private readonly config: CommissionConfigService) {}

  @Get('boundary')
  @ApiOperation({ summary: 'A03 commission formula/config boundary' })
  @ApiZodOk(commissionConfigBoundarySchema, 'Commission configuration boundary')
  boundary() { return this.config.boundary(); }

  @Get('collaborator-types')
  @ApiZodOk(collaboratorTypeListSchema, 'CTV type catalog')
  listTypes() { return this.config.listTypes(); }

  @Post('collaborator-types')
  @HttpCode(200)
  @ApiZodBody(collaboratorTypeWriteSchema)
  @ApiZodOk(collaboratorTypeSummarySchema, 'Created CTV type')
  createType(@Body(new ZodValidationPipe(collaboratorTypeWriteSchema)) body: CollaboratorTypeWrite, @CurrentUser() actor: AppIdentity) {
    return this.config.createType(actor, body);
  }

  @Put('collaborator-types/:id')
  @ApiZodBody(collaboratorTypeWriteSchema)
  @ApiZodOk(collaboratorTypeSummarySchema, 'Updated CTV type')
  updateType(@Param('id') id: string, @Body(new ZodValidationPipe(collaboratorTypeWriteSchema)) body: CollaboratorTypeWrite, @CurrentUser() actor: AppIdentity) {
    return this.config.updateType(actor, id, body);
  }

  @Patch('collaborator-types/:id/archive')
  @ApiZodOk(collaboratorTypeSummarySchema, 'Archived CTV type')
  archiveType(@Param('id') id: string, @CurrentUser() actor: AppIdentity) { return this.config.archiveType(actor, id, true); }

  @Patch('collaborator-types/:id/restore')
  @ApiZodOk(collaboratorTypeSummarySchema, 'Restored CTV type')
  restoreType(@Param('id') id: string, @CurrentUser() actor: AppIdentity) { return this.config.archiveType(actor, id, false); }

  @Get('collaborators')
  @ApiZodOk(commissionCollaboratorListSchema, 'Active CTV profiles with assigned type')
  listCollaborators() { return this.config.listCollaborators(); }

  @Patch('collaborators/:id/type')
  @ApiZodBody(collaboratorTypeAssignmentSchema)
  @ApiZodOk(commissionCollaboratorSummarySchema, 'Updated CTV type assignment')
  assignType(@Param('id') id: string, @Body(new ZodValidationPipe(collaboratorTypeAssignmentSchema)) body: CollaboratorTypeAssignment, @CurrentUser() actor: AppIdentity) {
    return this.config.assignCollaboratorType(actor, id, body);
  }

  @Get('allocation-targets')
  @ApiZodOk(commissionAllocationTargetListSchema, 'A03 department/position allocation targets')
  allocationTargets() { return this.config.listAllocationTargets(); }

  @Get('allocation-status')
  @ApiZodOk(commissionAllocationStatusSchema, 'A03 active allocation readiness')
  allocationStatus() { return this.config.allocationStatus(); }

  @Post('allocation-targets')
  @HttpCode(200)
  @ApiZodBody(commissionAllocationTargetWriteSchema)
  @ApiZodOk(commissionAllocationTargetSummarySchema, 'Created allocation target')
  createAllocationTarget(@Body(new ZodValidationPipe(commissionAllocationTargetWriteSchema)) body: CommissionAllocationTargetWrite, @CurrentUser() actor: AppIdentity) {
    return this.config.saveAllocationTarget(actor, null, body);
  }

  @Put('allocation-targets/:id')
  @ApiZodBody(commissionAllocationTargetWriteSchema)
  @ApiZodOk(commissionAllocationTargetSummarySchema, 'Updated allocation target')
  updateAllocationTarget(@Param('id') id: string, @Body(new ZodValidationPipe(commissionAllocationTargetWriteSchema)) body: CommissionAllocationTargetWrite, @CurrentUser() actor: AppIdentity) {
    return this.config.saveAllocationTarget(actor, id, body);
  }
}
