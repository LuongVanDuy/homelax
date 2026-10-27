import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { UserAccountService } from '../users/user-account.service.js';
import { PasswordResetService } from './password-reset.service.js';
import { EmailVerificationService } from './email-verification.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, UserAccountService, PasswordResetService, EmailVerificationService],
})
export class AuthModule {}
