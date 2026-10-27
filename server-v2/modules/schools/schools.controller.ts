import {
  Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  schoolListQuerySchema,
  schoolPageSchema,
  schoolDistanceResultSchema,
  publicSchoolListQuerySchema,
  publicSchoolPageSchema,
  schoolSchema,
  schoolWriteSchema,
  type PublicSchoolListQuery,
  type SchoolListQuery,
  type SchoolWrite,
} from '@tinyhouse/contracts';
import { CmsScreen, Public } from '../../common/auth/auth.decorators.js';
import type { RequestWithIdentity } from '../../common/auth/auth.types.js';
import { ApiStandardErrors, ApiZodBody, ApiZodOk } from '../../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { SchoolsService } from './schools.service.js';

@ApiTags('schools')
@ApiBearerAuth()
@ApiStandardErrors()
@CmsScreen('rooms')
@Controller('schools')
export class SchoolsController {
  constructor(private readonly schools: SchoolsService) {}

  @Get('public')
  @Public()
  @ApiZodOk(publicSchoolPageSchema, 'Public active school/campus catalog with valid coordinates')
  publicList(
    @Query(new ZodValidationPipe(publicSchoolListQuerySchema))
    query: PublicSchoolListQuery,
  ) {
    return this.schools.publicList(query);
  }

  @Get()
  @ApiZodOk(schoolPageSchema, 'Paged school catalog')
  list(
    @Query(new ZodValidationPipe(schoolListQuerySchema))
    query: SchoolListQuery,
  ) {
    return this.schools.list(query);
  }

  @Get(':id/building-distances')
  @ApiZodOk(schoolDistanceResultSchema, 'Building distances from a school/campus')
  buildingDistances(@Param('id') id: string, @Req() request: RequestWithIdentity) {
    return this.schools.buildingDistances(id, request.user);
  }

  @Post()
  @HttpCode(200)
  @ApiZodBody(schoolWriteSchema)
  @ApiZodOk(schoolSchema, 'Created school')
  create(
    @Body(new ZodValidationPipe(schoolWriteSchema)) body: SchoolWrite,
    @Req() request: RequestWithIdentity,
  ) {
    return this.schools.save(body, request.user);
  }

  @Put(':id')
  @ApiZodBody(schoolWriteSchema)
  @ApiZodOk(schoolSchema, 'Updated school')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(schoolWriteSchema)) body: SchoolWrite,
    @Req() request: RequestWithIdentity,
  ) {
    return this.schools.save(body, request.user, id);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @ApiZodOk(schoolSchema, 'Archived school')
  archive(@Param('id') id: string, @Req() request: RequestWithIdentity) {
    return this.schools.archive(id, request.user);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @ApiZodOk(schoolSchema, 'Restored school')
  restore(@Param('id') id: string, @Req() request: RequestWithIdentity) {
    return this.schools.restore(id, request.user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() request: RequestWithIdentity) {
    return this.schools.remove(id, request.user);
  }
}
