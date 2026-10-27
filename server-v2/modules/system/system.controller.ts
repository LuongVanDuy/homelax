import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/auth.decorators.js';
import { SystemService } from './system.service.js';

@ApiTags('system')
@Controller()
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('health')
  @Public()
  @ApiOperation({ summary: 'NestJS v2 health check' })
  health() {
    return this.systemService.health();
  }

  @Get('system/version')
  @Public()
  @ApiOperation({ summary: 'Shared system data version' })
  version() {
    return this.systemService.version();
  }
}
