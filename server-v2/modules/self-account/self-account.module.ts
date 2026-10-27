import { Controller, Delete, Get, Module, Param, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { favoritePageSchema, favoriteStateSchema, selfPageQuerySchema, selfRentalPageSchema, type SelfPageQuery } from '@tinyhouse/contracts';
import type { RequestWithIdentity } from '../../common/auth/auth.types.js';
import { ApiStandardErrors, ApiZodOk } from '../../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { SelfAccountService } from './self-account.service.js';

@ApiTags('self-account')
@ApiBearerAuth()
@ApiStandardErrors()
@Controller('account/self')
export class SelfAccountController {
  constructor(private readonly service: SelfAccountService) {}

  @Get('favorites')
  @ApiOperation({ summary: 'List own favorite units, including unavailable entries' })
  @ApiZodOk(favoritePageSchema, 'Own favorites')
  favorites(@Req() req: RequestWithIdentity, @Query(new ZodValidationPipe(selfPageQuerySchema)) query: SelfPageQuery) {
    return this.service.favorites(req.user!.id, query);
  }

  @Get('favorites/:unitId')
  @ApiOperation({ summary: 'Read own favorite state' })
  @ApiZodOk(favoriteStateSchema, 'Favorite state')
  state(@Req() req: RequestWithIdentity, @Param('unitId') unitId: string) { return this.service.favoriteState(req.user!.id, unitId); }

  @Put('favorites/:unitId')
  @ApiOperation({ summary: 'Save a public unit for current identity, idempotently' })
  @ApiZodOk(favoriteStateSchema, 'Favorite state')
  save(@Req() req: RequestWithIdentity, @Param('unitId') unitId: string) { return this.service.saveFavorite(req.user!.id, unitId); }

  @Delete('favorites/:unitId')
  @ApiOperation({ summary: 'Remove own favorite, including unavailable units' })
  @ApiZodOk(favoriteStateSchema, 'Favorite state')
  remove(@Req() req: RequestWithIdentity, @Param('unitId') unitId: string) { return this.service.removeFavorite(req.user!.id, unitId); }

  @Get('rentals')
  @ApiOperation({ summary: 'Read rental facts linked through Customer.user_id, always self scope' })
  @ApiZodOk(selfRentalPageSchema, 'Own rentals')
  rentals(@Req() req: RequestWithIdentity, @Query(new ZodValidationPipe(selfPageQuerySchema)) query: SelfPageQuery) {
    return this.service.rentals(req.user!.id, query);
  }
}

@Module({ imports: [RoomsModule], controllers: [SelfAccountController], providers: [SelfAccountService] })
export class SelfAccountModule {}
