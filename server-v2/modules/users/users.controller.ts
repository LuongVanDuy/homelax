import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';
import {
  accountDetailSchema,
  accountRelatedQuerySchema,
  accountLinkedProfilesPageSchema,
  accountActivityPageSchema,
  type AccountRelatedQuery,
  provisionUserRequestSchema,
  resetPasswordRequestSchema,
  userListQuerySchema,
  userPageSchema,
  userStatsSchema,
  userProfileWriteSchema,
  userStatusRequestSchema,
  userSummarySchema,
  type ProvisionUserRequest,
  type ResetPasswordRequest,
  type UserListQuery,
  type UserProfileWrite,
  type UserStatusRequest,
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
  UsersService,
} from './users.service.js';
import { UserAccountService } from './user-account.service.js';

@ApiTags('users')
@ApiBearerAuth()
@ApiStandardErrors()
@CmsScreen('permissions')
@Roles('admin', 'superadmin')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService:
      UsersService,
    private readonly accounts: UserAccountService,
  ) {}

  @Get()
  @ApiZodOk(userPageSchema, 'Paged user accounts')
  list(
    @Query(new ZodValidationPipe(userListQuerySchema))
    query: UserListQuery,
  ) {
    return this.usersService.list(query);
  }

  @Get('stats')
  @ApiZodOk(userStatsSchema, 'User account statistics')
  stats() {
    return this.usersService.stats();
  }

  @Get(':id')
  @ApiZodOk(accountDetailSchema, 'C03 administrator account detail')
  detail(@Param('id') id: string, @CurrentUser() actor: AppIdentity) {
    return this.accounts.detail(id, actor);
  }

  @Get(':id/linked-profiles')
  @ApiZodOk(accountLinkedProfilesPageSchema, 'Linked business profiles by canonical user ID')
  linkedProfiles(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(accountRelatedQuerySchema)) query: AccountRelatedQuery,
    @CurrentUser() actor: AppIdentity,
  ) { return this.accounts.linkedProfiles(id, actor, query); }

  @Get(':id/activity')
  @ApiZodOk(accountActivityPageSchema, 'Recent safe account activity within retention')
  activity(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(accountRelatedQuerySchema)) query: AccountRelatedQuery,
    @CurrentUser() actor: AppIdentity,
  ) { return this.accounts.activity(id, actor, query); }

  @Post()
  @HttpCode(200)
  @ApiZodOk(userSummarySchema, 'Updated user account')
  @ApiZodBody(
    userProfileWriteSchema,
  )
  save(
    @Body(
      new ZodValidationPipe(
        userProfileWriteSchema,
      ),
    )
    body: UserProfileWrite,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.usersService.save(
      body,
      actor,
    );
  }

  @Post('provision')
  @HttpCode(200)
  @ApiZodBody(
    provisionUserRequestSchema,
  )
  provision(
    @Body(
      new ZodValidationPipe(
        provisionUserRequestSchema,
      ),
    )
    body: ProvisionUserRequest,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.usersService.provision(
      body,
      actor,
    );
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @ApiZodBody(
    resetPasswordRequestSchema,
  )
  resetPassword(
    @Param('id')
    id: string,
    @Body(
      new ZodValidationPipe(
        resetPasswordRequestSchema,
      ),
    )
    body: ResetPasswordRequest,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.usersService.resetPassword(
      id,
      body.newPassword,
      actor,
    );
  }

  @Patch(':id/status')
  @ApiZodBody(
    userStatusRequestSchema,
  )
  updateStatus(
    @Param('id')
    id: string,
    @Body(
      new ZodValidationPipe(
        userStatusRequestSchema,
      ),
    )
    body: UserStatusRequest,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.usersService.updateStatus(
      id,
      body.status,
      actor,
    );
  }

  @Delete(':id')
  remove(
    @Param('id')
    id: string,
    @CurrentUser() actor: AppIdentity,
  ) {
    return this.usersService.remove(
      id,
      actor,
    );
  }
}
