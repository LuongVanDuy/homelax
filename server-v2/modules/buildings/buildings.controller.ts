import {
  Body,
  applyDecorators,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  buildingListQuerySchema,
  publicBuildingMapQuerySchema, publicBuildingMapResultSchema, type PublicBuildingMapQuery,
  buildingReadPageSchema,
  buildingReadDetailSchema,
  buildingStatsSchema,
  buildingViewPermissionsSchema,
  buildingWriteSchema,
  type BuildingListQuery,
  type BuildingViewPermissions,
  type BuildingWrite,
} from '@tinyhouse/contracts';
import {
  CmsScreen,
  PublicRead,
  Public,
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
  zodJsonSchema,
} from '../../common/openapi/zod-openapi.js';
import {
  BuildingsService,
} from './buildings.service.js';

// Derive advertised query fields from the same strict runtime contract.
const ApiPublicMapQuery = () => applyDecorators(...Object.entries(publicBuildingMapQuerySchema.shape).map(([name, schema]) =>
  ApiQuery({ name, required: false, schema: zodJsonSchema(schema) }),
));

@ApiTags('buildings')
@ApiStandardErrors()
@Controller('buildings')
export class BuildingsController {
  constructor(
    private readonly buildingsService:
      BuildingsService,
  ) {}

  @Get()
  @PublicRead()
  @ApiOperation({
    summary:
      'Public list; scope=cms requires authenticated CMS access',
  })
  @ApiZodOk(buildingReadPageSchema, 'Public projection by default; CMS fields only with authorized scope=cms')
  list(
    @Req() request: RequestWithIdentity,
    @Query(new ZodValidationPipe(buildingListQuerySchema))
    query: BuildingListQuery,
  ) {
    return this.buildingsService.list(request.user, query);
  }

  @ApiPublicMapQuery()
  @Get('map')
  @Public()
  @ApiOperation({ summary: 'Public matching building map, independent of list pagination and sort' })
  @ApiZodOk(publicBuildingMapResultSchema, 'Public-safe approximate map points and full matching counts')
  publicMap(@Query(new ZodValidationPipe(publicBuildingMapQuerySchema)) query: PublicBuildingMapQuery) {
    return this.buildingsService.publicMap(query);
  }

  @Get('stats')
  @ApiBearerAuth()
  @ApiZodOk(buildingStatsSchema, 'Building list statistics')
  stats(
    @Req() request: RequestWithIdentity,
  ) {
    return this.buildingsService.stats(request.user);
  }

  @Get(':id')
  @PublicRead()
  @ApiZodOk(buildingReadDetailSchema, 'Public detail including withdrawn read-only listings; authorized CMS shape for scope=cms')
  detail(
    @Param('id')
    id: string,
    @Req()
    request: RequestWithIdentity,
    @Query('scope')
    scope = 'public',
  ) {
    return this.buildingsService.detail(
      id,
      request.user,
      scope,
    );
  }

  @Post()
  @ApiBearerAuth()
  @CmsScreen('buildings')
  @HttpCode(200)
  @ApiZodBody(
    buildingWriteSchema,
  )
  save(
    @Body(
      new ZodValidationPipe(
        buildingWriteSchema,
      ),
    )
    body: BuildingWrite,
    @Req()
    request: RequestWithIdentity,
  ) {
    return this.buildingsService.save(
      body,
      request.user,
    );
  }

  @Put(':id')
  @ApiBearerAuth()
  @CmsScreen('buildings')
  @ApiZodBody(
    buildingWriteSchema,
  )
  saveById(
    @Param('id')
    id: string,
    @Body(
      new ZodValidationPipe(
        buildingWriteSchema,
      ),
    )
    body: BuildingWrite,
    @Req()
    request: RequestWithIdentity,
  ) {
    return this.buildingsService.save(
      {
        ...body,
        id,
      },
      request.user,
    );
  }

  @Delete(':id')
  @ApiBearerAuth()
  @CmsScreen('buildings')
  remove(
    @Param('id')
    id: string,
    @Req()
    request: RequestWithIdentity,
  ) {
    return this.buildingsService.remove(
      id,
      request.user,
    );
  }

  @Post(':id/archive')
  @ApiBearerAuth()
  @CmsScreen('buildings')
  @HttpCode(200)
  archive(
    @Param('id')
    id: string,
    @Req()
    request: RequestWithIdentity,
  ) {
    return this.buildingsService.archive(
      id,
      request.user,
    );
  }

  @Post(':id/restore')
  @ApiBearerAuth()
  @CmsScreen('buildings')
  @HttpCode(200)
  restore(
    @Param('id')
    id: string,
    @Req()
    request: RequestWithIdentity,
  ) {
    return this.buildingsService.restore(
      id,
      request.user,
    );
  }

  @Put(':id/view-permissions')
  @ApiBearerAuth()
  @CmsScreen('permissions')
  @ApiZodBody(
    buildingViewPermissionsSchema,
  )
  updateViewPermissions(
    @Param('id')
    id: string,
    @Body(
      new ZodValidationPipe(
        buildingViewPermissionsSchema,
      ),
    )
    body: BuildingViewPermissions,
    @Req()
    request: RequestWithIdentity,
  ) {
    return this.buildingsService.updateViewPermissions(
      id,
      body.viewerIds,
      request.user,
    );
  }
}
