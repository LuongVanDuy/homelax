import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { contactListQuerySchema, customerPageSchema, customerSummarySchema, customerWriteSchema, type ContactListQuery, type CustomerWrite } from '@tinyhouse/contracts';
import { Roles } from '../../common/auth/auth.decorators.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AppIdentity } from '../../common/auth/auth.types.js';
import { ApiStandardErrors, ApiZodBody, ApiZodOk } from '../../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ContactsService } from './contacts.service.js';

@ApiTags('customers')
@ApiBearerAuth()
@ApiStandardErrors()
@Roles('admin', 'superadmin')
@Controller('customers')
export class CustomersController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @ApiZodOk(customerPageSchema, 'Paged customer profiles')
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'archived', required: false, enum: ['active', 'archived', 'all'] })
  list(@Query(new ZodValidationPipe(contactListQuerySchema)) query: ContactListQuery) {
    return this.contacts.listCustomers(query);
  }

  @Get(':id')
  @ApiZodOk(customerSummarySchema, 'Customer profile')
  detail(@Param('id') id: string) {
    return this.contacts.getCustomer(id);
  }

  @Post()
  @HttpCode(200)
  @ApiZodBody(customerWriteSchema)
  @ApiZodOk(customerSummarySchema, 'Created customer profile')
  create(
    @Body(new ZodValidationPipe(customerWriteSchema)) body: CustomerWrite,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.contacts.createCustomer(body, actor);
  }

  @Put(':id')
  @ApiZodBody(customerWriteSchema)
  @ApiZodOk(customerSummarySchema, 'Updated customer profile')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(customerWriteSchema)) body: CustomerWrite,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.contacts.updateCustomer(id, body, actor);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @ApiZodOk(customerSummarySchema, 'Archived customer profile')
  archive(@Param('id') id: string, @CurrentUser() actor: AppIdentity) {
    return this.contacts.archiveCustomer(id, actor);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @ApiZodOk(customerSummarySchema, 'Restored customer profile')
  restore(@Param('id') id: string, @CurrentUser() actor: AppIdentity) {
    return this.contacts.restoreCustomer(id, actor);
  }
}
