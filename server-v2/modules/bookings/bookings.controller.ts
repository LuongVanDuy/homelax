import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  bookingAssigneeListQuerySchema,
  bookingAssigneeListSchema,
  bookingAssignmentRequestSchema,
  bookingListQuerySchema,
  bookingReadPageSchema,
  bookingReadSchema,
  bookingSelfPageSchema,
  bookingSelfSchema,
  bookingSelfListQuerySchema,
  bookingSelfLinkRequestSchema,
  bookingSelfLinkSchema,
  type BookingSelfListQuery,
  type BookingSelfLinkRequest,
  bookingPublicReceiptSchema,
  bookingRescheduleRequestSchema,
  bookingStatsSchema,
  bookingSummarySchema,
  bookingTransitionRequestSchema,
  createAdminBookingRequestSchema,
  createBookingRequestSchema,
  type BookingAssigneeListQuery,
  type BookingAssignmentRequest,
  type BookingListQuery,
  type BookingRescheduleRequest,
  type BookingTransitionRequest,
  type CreateAdminBookingRequest,
  type CreateBookingRequest,
} from '@tinyhouse/contracts';
import {
  CmsScreen,
  OptionalAuth,
  Roles,
} from '../../common/auth/auth.decorators.js';
import type {
  AppIdentity,
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
  BookingsService,
} from './bookings.service.js';

@ApiTags('bookings')
@ApiStandardErrors()
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService:
      BookingsService,
  ) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'List own bookings, or all bookings for CMS users with permission',
  })
  @ApiZodOk(bookingReadPageSchema, 'Paged bookings; public self projection for non-CMS identities')
  list(
    @Req() request: RequestWithIdentity,
    @Query(new ZodValidationPipe(bookingListQuerySchema))
    query: BookingListQuery,
  ) {
    return this.bookingsService.list(
      request.user as AppIdentity,
      query,
    );
  }

  @Get('stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Operational booking counters for the current row scope; not canonical U09 reporting metrics' })
  @ApiZodOk(bookingStatsSchema, 'Operational booking counters')
  stats(
    @Req() request: RequestWithIdentity,
  ) {
    return this.bookingsService.stats(request.user as AppIdentity);
  }

  @Get('assignees')
  @ApiBearerAuth()
  @CmsScreen('bookings')
  @ApiZodOk(bookingAssigneeListSchema, 'Eligible booking assignees')
  assignees(
    @Req() request: RequestWithIdentity,
    @Query(new ZodValidationPipe(bookingAssigneeListQuerySchema))
    query: BookingAssigneeListQuery,
  ) {
    return this.bookingsService.assignees(
      request.user as AppIdentity,
      query,
    );
  }

  @Get('self')
  @ApiBearerAuth()
  @ApiZodOk(bookingSelfPageSchema, 'Own bookings only, including for CMS users')
  selfList(
    @Req() request: RequestWithIdentity,
    @Query(new ZodValidationPipe(bookingSelfListQuerySchema)) query: BookingSelfListQuery,
  ) {
    return this.bookingsService.list(
      this.bookingsService.selfIdentity(request.user as AppIdentity),
      bookingListQuerySchema.parse(query),
    );
  }

  @Get('self/stats')
  @ApiBearerAuth()
  @ApiZodOk(bookingStatsSchema, 'Own booking counters')
  selfStats(@Req() request: RequestWithIdentity) {
    return this.bookingsService.stats(this.bookingsService.selfIdentity(request.user as AppIdentity));
  }

  @Get('self/:id')
  @ApiBearerAuth()
  @ApiZodOk(bookingSelfSchema, 'Own booking detail')
  selfDetail(@Param('id') id: string, @Req() request: RequestWithIdentity) {
    return this.bookingsService.readDetail(this.bookingsService.selfIdentity(request.user as AppIdentity), id);
  }

  @Get(':id/self-link')
  @ApiBearerAuth()
  @Roles('admin', 'superadmin')
  @ApiZodOk(bookingSelfLinkSchema, 'Verified account link')
  selfLink(@Param('id') id: string) {
    return this.bookingsService.selfLink(id);
  }

  @Patch(':id/self-link')
  @ApiBearerAuth()
  @Roles('admin', 'superadmin')
  @ApiZodBody(bookingSelfLinkRequestSchema)
  @ApiZodOk(bookingSelfLinkSchema, 'Admin verified account link')
  linkSelf(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(bookingSelfLinkRequestSchema)) body: BookingSelfLinkRequest,
    @Req() request: RequestWithIdentity,
  ) {
    return this.bookingsService.linkSelf(id, body, request.user as AppIdentity);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiZodOk(bookingReadSchema, 'Booking detail; public self projection for non-CMS identities')
  detail(
    @Param('id') id: string,
    @Req() request: RequestWithIdentity,
  ) {
    return this.bookingsService.readDetail(
      request.user as AppIdentity,
      id,
    );
  }

  @Post()
  @OptionalAuth()
  @HttpCode(200)
  @ApiZodBody(
    createBookingRequestSchema,
  )
  @ApiZodOk(bookingPublicReceiptSchema, 'Public booking receipt')
  create(
    @Body(
      new ZodValidationPipe(
        createBookingRequestSchema,
      ),
    )
    body: CreateBookingRequest,
    @Req() request: RequestWithIdentity,
  ) {
    return this.bookingsService.create(
      body,
      request.user,
    );
  }

  @Post('admin')
  @ApiBearerAuth()
  @CmsScreen('bookings')
  @HttpCode(200)
  @ApiZodBody(createAdminBookingRequestSchema)
  @ApiZodOk(bookingSummarySchema, 'Created admin booking')
  createAdmin(
    @Body(new ZodValidationPipe(createAdminBookingRequestSchema))
    body: CreateAdminBookingRequest,
    @Req() request: RequestWithIdentity,
  ) {
    return this.bookingsService.createAdmin(
      body,
      request.user as AppIdentity,
    );
  }

  @Patch(':id/assignment')
  @ApiBearerAuth()
  @CmsScreen('bookings')
  @ApiZodBody(bookingAssignmentRequestSchema)
  @ApiZodOk(bookingSummarySchema, 'Updated booking assignment')
  updateAssignment(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(bookingAssignmentRequestSchema))
    body: BookingAssignmentRequest,
    @Req() request: RequestWithIdentity,
  ) {
    return this.bookingsService.updateAssignment(
      id,
      body.assignedUserId,
      request.user as AppIdentity,
    );
  }

  @Patch(':id/reschedule')
  @ApiBearerAuth()
  @CmsScreen('bookings')
  @ApiZodBody(bookingRescheduleRequestSchema)
  @ApiZodOk(bookingSummarySchema, 'Rescheduled booking')
  reschedule(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(bookingRescheduleRequestSchema))
    body: BookingRescheduleRequest,
    @Req() request: RequestWithIdentity,
  ) {
    return this.bookingsService.reschedule(
      id,
      body,
      request.user as AppIdentity,
    );
  }

  @Patch(':id/transition')
  @ApiBearerAuth()
  @CmsScreen('bookings')
  @ApiZodBody(bookingTransitionRequestSchema)
  @ApiZodOk(bookingSummarySchema, 'Transitioned booking status')
  transition(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(bookingTransitionRequestSchema))
    body: BookingTransitionRequest,
    @Req() request: RequestWithIdentity,
  ) {
    return this.bookingsService.transition(
      id,
      body.transition,
      request.user as AppIdentity,
    );
  }

}
