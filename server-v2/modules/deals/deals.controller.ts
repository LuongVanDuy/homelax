import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  cancelDealRequestSchema,
  changeDealRoomUnitRequestSchema,
  createDealDirectRequestSchema,
  createDealFromBookingRequestSchema,
  dealAssigneeListSchema,
  dealAssignmentRequestSchema,
  dealFinanceBoundarySchema,
  dealListQuerySchema,
  dealNoteRequestSchema,
  dealPageSchema,
  dealRoomUnitHistorySchema,
  dealSummarySchema,
  updateDealCommercialTermsRequestSchema,
  updateDealContractDepositRequestSchema,
  updateDealRentalScheduleRequestSchema,
  type CancelDealRequest,
  type ChangeDealRoomUnitRequest,
  type CreateDealDirectRequest,
  type CreateDealFromBookingRequest,
  type DealAssignmentRequest,
  type DealListQuery,
  type DealNoteRequest,
  type UpdateDealCommercialTermsRequest,
  type UpdateDealContractDepositRequest,
  type UpdateDealRentalScheduleRequest,
} from '@tinyhouse/contracts';
import { CmsScreen } from '../../common/auth/auth.decorators.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AppIdentity } from '../../common/auth/auth.types.js';
import {
  ApiStandardErrors,
  ApiZodBody,
  ApiZodOk,
} from '../../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { DealsService } from './deals.service.js';

@ApiTags('deals')
@ApiStandardErrors()
@ApiBearerAuth()
@CmsScreen('deals')
@Controller('deals')
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Get()
  @ApiOperation({
    summary: 'List rental deals within the current Deal row scope',
  })
  @ApiZodOk(dealPageSchema, 'Paged rental deals')
  list(
    @Query(new ZodValidationPipe(dealListQuerySchema))
    query: DealListQuery,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.deals.list(actor, query);
  }

  @Get('assignees')
  @ApiZodOk(dealAssigneeListSchema, 'Deal assignee options')
  assignees(
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.deals.assignees(actor);
  }

  @Get('finance-boundary')
  @ApiOperation({
    summary: 'U06.5 financial boundary: recurring rent belongs to Cyhome; invoice/refund scope is still pending D06',
  })
  @ApiZodOk(dealFinanceBoundarySchema, 'Deal financial boundary')
  financeBoundary(
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.deals.financeBoundary(actor);
  }

  @Get(':id')
  @ApiZodOk(dealSummarySchema, 'Rental deal detail')
  detail(
    @Param('id') id: string,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.deals.detail(actor, id);
  }

  @Get(':id/room-history')
  @ApiZodOk(dealRoomUnitHistorySchema, 'Deal Room Unit change history')
  roomHistory(
    @Param('id') id: string,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.deals.roomUnitHistory(actor, id);
  }

  @Patch(':id/room-unit')
  @HttpCode(200)
  @ApiOperation({ summary: 'U06.4 change the actual Room Unit, append Deal history, release the old Unit and apply the approved inventory policy to the target Unit' })
  @ApiZodBody(changeDealRoomUnitRequestSchema)
  @ApiZodOk(dealSummarySchema, 'Updated Deal Room Unit')
  changeRoomUnit(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(changeDealRoomUnitRequestSchema)) body: ChangeDealRoomUnitRequest,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.deals.changeRoomUnit(actor, id, body);
  }

  @Patch(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'U06.4 cancel Deal lifecycle without deleting history and release the Room Unit unless maintenance/archived protects it' })
  @ApiZodBody(cancelDealRequestSchema)
  @ApiZodOk(dealSummarySchema, 'Cancelled Deal')
  cancel(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelDealRequestSchema)) body: CancelDealRequest,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.deals.cancel(actor, id, body);
  }

  @Patch(':id/assignment')
  @HttpCode(200)
  @ApiZodBody(dealAssignmentRequestSchema)
  @ApiZodOk(dealSummarySchema, 'Updated Deal assignee')
  updateAssignment(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(dealAssignmentRequestSchema))
    body: DealAssignmentRequest,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.deals.updateAssignment(actor, id, body);
  }

  @Patch(':id/notes')
  @HttpCode(200)
  @ApiZodBody(dealNoteRequestSchema)
  @ApiZodOk(dealSummarySchema, 'Updated Deal note')
  addNote(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(dealNoteRequestSchema))
    body: DealNoteRequest,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.deals.addNote(actor, id, body);
  }

  @Patch(':id/commercial-terms')
  @HttpCode(200)
  @ApiOperation({
    summary: 'A02 update monthly rent and explicit optional contract months for a Deal',
  })
  @ApiZodBody(updateDealCommercialTermsRequestSchema)
  @ApiZodOk(dealSummarySchema, 'Updated Deal commercial terms')
  updateCommercialTerms(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDealCommercialTermsRequestSchema))
    body: UpdateDealCommercialTermsRequest,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.deals.updateCommercialTerms(actor, id, body);
  }

  @Patch(':id/contract-deposit')
  @HttpCode(200)
  @ApiOperation({
    summary: 'U06.2 update independent contract-signed and deposit facts for a Deal',
  })
  @ApiZodBody(updateDealContractDepositRequestSchema)
  @ApiZodOk(dealSummarySchema, 'Updated contract/deposit facts')
  updateContractDeposit(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDealContractDepositRequestSchema))
    body: UpdateDealContractDepositRequest,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.deals.updateContractDeposit(actor, id, body);
  }

  @Patch(':id/rental-schedule')
  @HttpCode(200)
  @ApiOperation({
    summary: 'U06.3 update operational rental schedule dates for a Deal',
  })
  @ApiZodBody(updateDealRentalScheduleRequestSchema)
  @ApiZodOk(dealSummarySchema, 'Updated rental schedule')
  updateRentalSchedule(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDealRentalScheduleRequestSchema))
    body: UpdateDealRentalScheduleRequest,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.deals.updateRentalSchedule(actor, id, body);
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Create a direct Deal from Customer + actual Room Unit; attribution is resolved server-side from Customer',
  })
  @ApiZodBody(createDealDirectRequestSchema)
  @ApiZodOk(dealSummarySchema, 'Created direct rental deal')
  createDirect(
    @Body(new ZodValidationPipe(createDealDirectRequestSchema))
    body: CreateDealDirectRequest,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.deals.createDirect(body, actor);
  }

  @Post('from-booking')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Create a Deal from an existing Booking; Booking → Deal is one-to-one',
  })
  @ApiZodBody(createDealFromBookingRequestSchema)
  @ApiZodOk(dealSummarySchema, 'Created rental deal')
  createFromBooking(
    @Body(new ZodValidationPipe(createDealFromBookingRequestSchema))
    body: CreateDealFromBookingRequest,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.deals.createFromBooking(body, actor);
  }
}
