import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { getRequiredEnv } from '../../config/environment.js';
import { AuthIdentityService } from './auth-identity.service.js';
import { SecurityGuard } from './security.guard.js';

@Global()
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: getRequiredEnv('JWT_ACCESS_SECRET'),
    }),
  ],
  providers: [
    AuthIdentityService,
    {
      provide: APP_GUARD,
      useClass: SecurityGuard,
    },
  ],
  exports: [AuthIdentityService, JwtModule],
})
export class SecurityModule {}
