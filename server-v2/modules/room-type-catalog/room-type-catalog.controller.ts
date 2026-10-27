import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  publicRoomTypeCatalogListQuerySchema,
  publicRoomTypeCatalogPageSchema,
  roomTypeCatalogListQuerySchema,
  roomTypeCatalogPageSchema,
  roomTypeCatalogSchema,
  roomTypeCatalogWriteSchema,
  type PublicRoomTypeCatalogListQuery,
  type RoomTypeCatalogListQuery,
  type RoomTypeCatalogWrite,
} from '@tinyhouse/contracts';
import { CmsScreen, Public } from '../../common/auth/auth.decorators.js';
import type { RequestWithIdentity } from '../../common/auth/auth.types.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ApiStandardErrors, ApiZodBody, ApiZodOk } from '../../common/openapi/zod-openapi.js';
import { RoomTypeCatalogService } from './room-type-catalog.service.js';

@ApiTags('room-type-catalog')
@ApiStandardErrors()
@Controller('room-types')
export class RoomTypeCatalogController {
  constructor(private readonly catalog: RoomTypeCatalogService) {}

  @Get('public')
  @Public()
  @ApiOperation({ summary: 'Danh mục loại phòng public đang hoạt động' })
  @ApiZodOk(publicRoomTypeCatalogPageSchema, 'Public room type catalog')
  publicList(@Query(new ZodValidationPipe(publicRoomTypeCatalogListQuerySchema)) query: PublicRoomTypeCatalogListQuery) {
    return this.catalog.publicList(query);
  }

  @Get()
  @ApiBearerAuth()
  @CmsScreen('rooms')
  @ApiZodOk(roomTypeCatalogPageSchema, 'Room type catalog')
  list(@Query(new ZodValidationPipe(roomTypeCatalogListQuerySchema)) query: RoomTypeCatalogListQuery) {
    return this.catalog.list(query);
  }

  @Post()
  @ApiBearerAuth()
  @CmsScreen('rooms')
  @ApiZodBody(roomTypeCatalogWriteSchema)
  @ApiZodOk(roomTypeCatalogSchema, 'Created room type catalog item')
  save(@Req() request: RequestWithIdentity, @Body(new ZodValidationPipe(roomTypeCatalogWriteSchema)) data: RoomTypeCatalogWrite) {
    return this.catalog.save(data, request.user);
  }

  @Put(':id')
  @ApiBearerAuth()
  @CmsScreen('rooms')
  @ApiZodBody(roomTypeCatalogWriteSchema)
  @ApiZodOk(roomTypeCatalogSchema, 'Updated room type catalog item')
  update(@Req() request: RequestWithIdentity, @Param('id') id: string, @Body(new ZodValidationPipe(roomTypeCatalogWriteSchema)) data: RoomTypeCatalogWrite) {
    return this.catalog.save(data, request.user, id);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @ApiBearerAuth()
  @CmsScreen('rooms')
  @ApiZodOk(roomTypeCatalogSchema, 'Archived room type catalog item')
  archive(@Req() request: RequestWithIdentity, @Param('id') id: string) { return this.catalog.archive(id, request.user); }

  @Post(':id/restore')
  @HttpCode(200)
  @ApiBearerAuth()
  @CmsScreen('rooms')
  @ApiZodOk(roomTypeCatalogSchema, 'Restored room type catalog item')
  restore(@Req() request: RequestWithIdentity, @Param('id') id: string) { return this.catalog.restore(id, request.user); }

  @Delete(':id')
  @ApiBearerAuth()
  @CmsScreen('rooms')
  remove(@Req() request: RequestWithIdentity, @Param('id') id: string) { return this.catalog.remove(id, request.user); }
}
