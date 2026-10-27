import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';
import {
  roleListQuerySchema,
  rolePageSchema,
  roleSummarySchema,
  roleWriteSchema,
  type RoleListQuery,
  type RoleWrite,
} from '@tinyhouse/contracts';
import {
  CmsScreen,
  Roles,
} from '../../common/auth/auth.decorators.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AppIdentity } from '../../common/auth/auth.types.js';
import {
  ZodValidationPipe,
} from '../../common/pipes/zod-validation.pipe.js';
import {
  ApiStandardErrors,
  ApiZodBody,
  ApiZodOk,
} from '../../common/openapi/zod-openapi.js';
import {
  RolesService,
} from './roles.service.js';

@ApiTags('roles')
@ApiBearerAuth()
@ApiStandardErrors()
@CmsScreen('permissions')
@Roles('admin', 'superadmin')
@Controller('roles')
export class RolesController {
  constructor(
    private readonly rolesService:
      RolesService,
  ) {}

  @Get()
  @ApiZodOk(rolePageSchema, 'Paged roles')
  list(
    @Query(new ZodValidationPipe(roleListQuerySchema))
    query: RoleListQuery,
  ) {
    return this.rolesService.list(query);
  }

  @Get(':id')
  @ApiZodOk(roleSummarySchema, 'Role')
  detail(
    @Param('id')
    id: string,
  ) {
    return this.rolesService.detail(
      id,
    );
  }

  @Post()
  @HttpCode(200)
  @ApiZodBody(roleWriteSchema)
  @ApiZodOk(roleSummarySchema, 'Saved role')
  save(
    @Body(
      new ZodValidationPipe(
        roleWriteSchema,
      ),
    )
    body: RoleWrite,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.rolesService.save(
      body,
      actor,
    );
  }

  @Put(':id')
  @ApiZodBody(roleWriteSchema)
  @ApiZodOk(roleSummarySchema, 'Updated role')
  update(
    @Param('id')
    id: string,
    @Body(
      new ZodValidationPipe(
        roleWriteSchema,
      ),
    )
    body: RoleWrite,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.rolesService.update(
      id,
      body,
      actor,
    );
  }

  @Delete(':id')
  remove(
    @Param('id')
    id: string,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.rolesService.remove(
      id,
      actor,
    );
  }
}
