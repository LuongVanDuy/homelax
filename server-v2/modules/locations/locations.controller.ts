import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { locationSearchQuerySchema, locationSearchResultSchema } from '@tinyhouse/contracts';
import { Public } from '../../common/auth/auth.decorators.js';
import { ApiStandardErrors, ApiZodOk } from '../../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { LocationsService } from './locations.service.js';

@ApiTags('locations')
@ApiStandardErrors()
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}
  @Public()
  @Get('search')
  @ApiZodOk(locationSearchResultSchema, 'Button-triggered Hanoi address lookup; cached and globally throttled')
  search(@Query(new ZodValidationPipe(locationSearchQuerySchema)) query: { q: string }) {
    return this.locations.search(query.q);
  }
}
