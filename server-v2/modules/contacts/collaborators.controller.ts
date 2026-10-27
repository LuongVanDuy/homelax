import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { collaboratorPageSchema, collaboratorSummarySchema, collaboratorWriteSchema, contactListQuerySchema, type CollaboratorWrite, type ContactListQuery } from '@tinyhouse/contracts';
import { Roles } from '../../common/auth/auth.decorators.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AppIdentity } from '../../common/auth/auth.types.js';
import { ApiStandardErrors, ApiZodBody, ApiZodOk } from '../../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ContactsService } from './contacts.service.js';

@ApiTags('collaborators')
@ApiBearerAuth()
@ApiStandardErrors()
@Roles('admin', 'superadmin')
@Controller('collaborators')
export class CollaboratorsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @ApiZodOk(collaboratorPageSchema, 'Paged collaborator profiles')
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'archived', required: false, enum: ['active', 'archived', 'all'] })
  list(@Query(new ZodValidationPipe(contactListQuerySchema)) query: ContactListQuery) {
    return this.contacts.listCollaborators(query);
  }

  @Get(':id')
  @ApiZodOk(collaboratorSummarySchema, 'Collaborator profile')
  detail(@Param('id') id: string) {
    return this.contacts.getCollaborator(id);
  }

  @Post()
  @HttpCode(200)
  @ApiZodBody(collaboratorWriteSchema)
  @ApiZodOk(collaboratorSummarySchema, 'Created collaborator profile')
  create(
    @Body(new ZodValidationPipe(collaboratorWriteSchema)) body: CollaboratorWrite,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.contacts.createCollaborator(body, actor);
  }

  @Put(':id')
  @ApiZodBody(collaboratorWriteSchema)
  @ApiZodOk(collaboratorSummarySchema, 'Updated collaborator profile')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(collaboratorWriteSchema)) body: CollaboratorWrite,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.contacts.updateCollaborator(id, body, actor);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @ApiZodOk(collaboratorSummarySchema, 'Archived collaborator profile')
  archive(@Param('id') id: string, @CurrentUser() actor: AppIdentity) {
    return this.contacts.archiveCollaborator(id, actor);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @ApiZodOk(collaboratorSummarySchema, 'Restored collaborator profile')
  restore(@Param('id') id: string, @CurrentUser() actor: AppIdentity) {
    return this.contacts.restoreCollaborator(id, actor);
  }
}
