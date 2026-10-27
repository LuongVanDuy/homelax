import {
  Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  amenityListQuerySchema,
  amenityPageSchema,
  amenityWriteSchema,
  publicAmenityListQuerySchema,
  publicAmenityPageSchema,
  type AmenityListQuery,
  type AmenityWrite,
  type PublicAmenityListQuery,
} from '@tinyhouse/contracts';
import { CmsScreen, Public } from '../../common/auth/auth.decorators.js';
import type { RequestWithIdentity } from '../../common/auth/auth.types.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ApiStandardErrors, ApiZodBody, ApiZodOk } from '../../common/openapi/zod-openapi.js';
import { AmenitiesService } from './amenities.service.js';

@ApiTags('amenities')
@ApiBearerAuth()
@ApiStandardErrors()
@CmsScreen('rooms')
@Controller('amenities')
export class AmenitiesController {
  constructor(private readonly amenities: AmenitiesService) {}

  @Get('public')
  @Public()
  @ApiZodOk(publicAmenityPageSchema, 'Public active amenities grouped by building or room scope')
  publicList(
    @Query(new ZodValidationPipe(publicAmenityListQuerySchema))
    query: PublicAmenityListQuery,
  ) {
    return this.amenities.publicList(query);
  }

  @Get()
  @ApiZodOk(amenityPageSchema, 'Paged amenities')
  list(
    @Query(new ZodValidationPipe(amenityListQuerySchema))
    query: AmenityListQuery,
  ) {
    return this.amenities.list(query);
  }

  @Post()
  @HttpCode(200)
  @ApiZodBody(amenityWriteSchema)
  create(
    @Body(new ZodValidationPipe(amenityWriteSchema)) body: AmenityWrite,
    @Req() request: RequestWithIdentity,
  ) {
    return this.amenities.save(body, request.user);
  }

  @Put(':id')
  @ApiZodBody(amenityWriteSchema)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(amenityWriteSchema)) body: AmenityWrite,
    @Req() request: RequestWithIdentity,
  ) {
    return this.amenities.save(body, request.user, id);
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(@Param('id') id: string, @Req() request: RequestWithIdentity) {
    return this.amenities.archive(id, request.user);
  }

  @Post(':id/restore')
  @HttpCode(200)
  restore(@Param('id') id: string, @Req() request: RequestWithIdentity) {
    return this.amenities.restore(id, request.user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() request: RequestWithIdentity) {
    return this.amenities.remove(id, request.user);
  }
}
