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
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  roomListQuerySchema,
  publicRoomSearchQuerySchema,
  publicRoomSearchPageSchema,
  type PublicRoomSearchQuery,
  publicRoomPageSchema,
  roomReadPageSchema,
  roomReadDetailSchema,
  roomStatsSchema,
  roomTypeWriteSchema,
  roomUnitWriteSchema,
  type RoomListQuery,
  type RoomTypeWrite,
  type RoomUnitWrite,
} from "@tinyhouse/contracts";
import {
  CmsScreen,
  Public,
  PublicRead,
} from "../../common/auth/auth.decorators.js";
import type { RequestWithIdentity } from "../../common/auth/auth.types.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import {
  ApiStandardErrors,
  ApiZodBody,
  ApiZodOk,
} from "../../common/openapi/zod-openapi.js";
import { RoomsService } from "./rooms.service.js";

@ApiTags("rooms")
@ApiStandardErrors()
@Controller("rooms")
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get("search")
  @Public()
  @ApiZodOk(publicRoomSearchPageSchema, "Public Room Type search with distinct available Unit count")
  publicSearch(
    @Query(new ZodValidationPipe(publicRoomSearchQuerySchema)) query: PublicRoomSearchQuery,
  ) {
    return this.roomsService.publicSearch(query);
  }

  @Get()
  @PublicRead()
  @ApiOperation({
    summary: "Public active Room Types; scope=cms includes archived Room Types",
  })
  @ApiZodOk(roomReadPageSchema, "Public Room Types by default; authorized CMS fields for scope=cms")
  list(
    @Req() request: RequestWithIdentity,
    @Query(new ZodValidationPipe(roomListQuerySchema))
    query: RoomListQuery,
  ) {
    return this.roomsService.list(request.user, query);
  }

  @Get("stats")
  @ApiBearerAuth()
  @ApiZodOk(roomStatsSchema, "Room inventory statistics")
  stats(@Req() request: RequestWithIdentity) {
    return this.roomsService.stats(request.user);
  }

  @Get("building/:buildingId")
  @Public()
  @ApiZodOk(publicRoomPageSchema, "Public-only Room Types by building, regardless of requested scope")
  byBuilding(
    @Param("buildingId") buildingId: string,
    @Query(new ZodValidationPipe(roomListQuerySchema))
    query: RoomListQuery,
  ) {
    return this.roomsService.byBuilding(buildingId, query);
  }

  @Get(":id")
  @PublicRead()
  @ApiZodOk(roomReadDetailSchema, "Public detail including withdrawn listings; authorized CMS shape for scope=cms")
  detail(
    @Param("id") id: string,
    @Req() request: RequestWithIdentity,
    @Query("scope") scope = "public",
  ) {
    return this.roomsService.detail(id, request.user, scope);
  }

  @Post()
  @ApiBearerAuth()
  @CmsScreen("rooms")
  @HttpCode(200)
  @ApiZodBody(roomTypeWriteSchema)
  save(
    @Body(new ZodValidationPipe(roomTypeWriteSchema))
    body: RoomTypeWrite,
    @Req() request: RequestWithIdentity,
  ) {
    return this.roomsService.save(body, request.user);
  }

  @Put(":id")
  @ApiBearerAuth()
  @CmsScreen("rooms")
  @ApiZodBody(roomTypeWriteSchema)
  saveById(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(roomTypeWriteSchema))
    body: RoomTypeWrite,
    @Req() request: RequestWithIdentity,
  ) {
    return this.roomsService.save({ ...body, id }, request.user);
  }

  @Post(":roomTypeId/units")
  @ApiBearerAuth()
  @CmsScreen("rooms")
  @HttpCode(200)
  @ApiZodBody(roomUnitWriteSchema)
  createUnit(
    @Param("roomTypeId") roomTypeId: string,
    @Body(new ZodValidationPipe(roomUnitWriteSchema))
    body: RoomUnitWrite,
    @Req() request: RequestWithIdentity,
  ) {
    return this.roomsService.saveUnit(roomTypeId, null, body, request.user);
  }

  @Put(":roomTypeId/units/:unitId")
  @ApiBearerAuth()
  @CmsScreen("rooms")
  @ApiZodBody(roomUnitWriteSchema)
  updateUnit(
    @Param("roomTypeId") roomTypeId: string,
    @Param("unitId") unitId: string,
    @Body(new ZodValidationPipe(roomUnitWriteSchema))
    body: RoomUnitWrite,
    @Req() request: RequestWithIdentity,
  ) {
    return this.roomsService.saveUnit(roomTypeId, unitId, body, request.user);
  }

  @Delete(":roomTypeId/units/:unitId")
  @ApiBearerAuth()
  @CmsScreen("rooms")
  removeUnit(
    @Param("roomTypeId") roomTypeId: string,
    @Param("unitId") unitId: string,
    @Req() request: RequestWithIdentity,
  ) {
    return this.roomsService.removeUnit(roomTypeId, unitId, request.user);
  }

  @Delete(":id")
  @ApiBearerAuth()
  @CmsScreen("rooms")
  remove(@Param("id") id: string, @Req() request: RequestWithIdentity) {
    return this.roomsService.remove(id, request.user);
  }

  @Post(":id/archive")
  @ApiBearerAuth()
  @CmsScreen("rooms")
  @HttpCode(200)
  archive(@Param("id") id: string, @Req() request: RequestWithIdentity) {
    return this.roomsService.archive(id, request.user);
  }

  @Post(":id/restore")
  @ApiBearerAuth()
  @CmsScreen("rooms")
  @HttpCode(200)
  restore(@Param("id") id: string, @Req() request: RequestWithIdentity) {
    return this.roomsService.restore(id, request.user);
  }
}
