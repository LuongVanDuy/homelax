import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type {
  Request,
  Response,
} from 'express';
import {
  accountDetailSchema,
  accountProfileResultSchema,
  accountPasswordResultSchema,
  authSessionResponseSchema,
  changePasswordRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  registerResponseSchema,
  updateProfileRequestSchema,
  forgotPasswordRequestSchema,
  forgotPasswordResponseSchema,
  publicResetPasswordRequestSchema,
  resetPasswordResponseSchema,
  requestVerificationSchema,
  requestVerificationResponseSchema,
  verifyEmailRequestSchema,
  verifyEmailResponseSchema,
  type ForgotPasswordRequest,
  type PublicResetPasswordRequest,
  type ChangePasswordRequest,
  type LoginRequest,
  type RegisterRequest,
  type UpdateProfileRequest,
} from '@tinyhouse/contracts';
import {
  Public,
} from '../../common/auth/auth.decorators.js';
import type {
  AppIdentity,
  RequestWithIdentity,
} from '../../common/auth/auth.types.js';
import {
  ZodValidationPipe,
} from '../../common/pipes/zod-validation.pipe.js';
import {
  ApiStandardErrors,
  ApiZodBody,
  ApiZodOk,
} from '../../common/openapi/zod-openapi.js';
import {
  getAuthRuntimeConfig,
} from '../../config/auth-config.js';
import { AuthService } from './auth.service.js';
import { UserAccountService } from '../users/user-account.service.js';
import { PasswordResetService } from './password-reset.service.js';
import { EmailVerificationService } from './email-verification.service.js';

const REFRESH_COOKIE =
  'tinyhouse_refresh';

function refreshCookieOptions() {
  const config = getAuthRuntimeConfig();

  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.AUTH_COOKIE_SECURE === 'false'
      ? false
      : process.env.AUTH_COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    path: '/api/v2/auth',
    maxAge:
      config.refreshTtlDays *
      24 *
      60 *
      60 *
      1000,
  };
}

function responsePayload(
  session: any,
) {
  const {
    refreshToken: _refreshToken,
    refreshExpiresAt:
      _refreshExpiresAt,
    ...safe
  } = session;

  return safe;
}

@ApiTags('auth')
@ApiStandardErrors()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService:
      AuthService,
    private readonly accounts: UserAccountService,
    private readonly recovery: PasswordResetService,
    private readonly verification: EmailVerificationService,
  ) {}

  @Get('runtime')
  @Public()
  @ApiOperation({
    summary:
      'PostgreSQL auth runtime state without secrets',
  })
  runtime() {
    return this.authService.runtime();
  }

  @Post('login')
  @Public()
  @HttpCode(200)
  @ApiZodBody(loginRequestSchema)
  @ApiZodOk(
    authSessionResponseSchema,
    'Authenticated session',
  )
  async login(
    @Body(
      new ZodValidationPipe(
        loginRequestSchema,
      ),
    )
    body: LoginRequest,
    @Res({ passthrough: true })
    response: Response,
  ) {
    const session =
      await this.authService.login(
        body.email,
        body.password,
      );

    response.cookie(
      REFRESH_COOKIE,
      session.refreshToken,
      refreshCookieOptions(),
    );

    return responsePayload(session);
  }

  @Post('register')
  @Public()
  @HttpCode(200)
  @ApiZodBody(
    registerRequestSchema,
  )
  @ApiZodOk(registerResponseSchema, 'Active customer account; sign in with email and password')
  register(
    @Body(
      new ZodValidationPipe(
        registerRequestSchema,
      ),
    )
    body: RegisterRequest,
  ) {
    return this.authService.register(
      body,
    );
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true })
    response: Response,
  ) {
    const raw =
      request.cookies?.[
        REFRESH_COOKIE
      ] || '';

    const session =
      await this.authService.refresh(
        raw,
      );

    response.cookie(
      REFRESH_COOKIE,
      session.refreshToken,
      refreshCookieOptions(),
    );

    return responsePayload(session);
  }

  @Post('logout')
  @Public()
  @HttpCode(200)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true })
    response: Response,
  ) {
    const raw =
      request.cookies?.[
        REFRESH_COOKIE
      ] || '';

    const result =
      await this.authService.logout(
        raw,
      );

    response.clearCookie(
      REFRESH_COOKIE,
      {
        ...refreshCookieOptions(),
        maxAge: 0,
      },
    );

    return result;
  }

  @Post('google')
  @Public()
  @HttpCode(410)
  google() {
    return this.authService.google();
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(200)
  @ApiZodBody(forgotPasswordRequestSchema)
  @ApiZodOk(forgotPasswordResponseSchema, 'Neutral recovery request acknowledgement')
  forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordRequestSchema)) body: ForgotPasswordRequest,
    @Req() request: Request,
  ) {
    // Express honors only the explicit TRUSTED_PROXY_CIDRS configured at bootstrap.
    return this.recovery.requestReset(body.email, request.ip || request.socket.remoteAddress || 'unknown');
  }

  @Post('reset-password')
  @Public()
  @HttpCode(200)
  @ApiZodBody(publicResetPasswordRequestSchema)
  @ApiZodOk(resetPasswordResponseSchema, 'Password changed; all refresh sessions revoked')
  async resetPassword(
    @Body(new ZodValidationPipe(publicResetPasswordRequestSchema)) body: PublicResetPasswordRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.recovery.resetPassword(body.token, body.newPassword, request.ip || request.socket.remoteAddress || 'unknown');
    response.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: 0 });
    return result;
  }

  @Post('email-verification/request')
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiZodBody(requestVerificationSchema)
  @ApiZodOk(requestVerificationResponseSchema, 'Send optional verification to the authenticated account email')
  requestEmailVerification(
    @Body(new ZodValidationPipe(requestVerificationSchema)) _body: Record<string, never>,
    @Req() request: Request & RequestWithIdentity,
  ) {
    return this.verification.requestVerification(request.user!.id, request.ip || request.socket.remoteAddress || 'unknown');
  }

  @Post('email-verification/confirm')
  @Public()
  @HttpCode(200)
  @ApiZodBody(verifyEmailRequestSchema)
  @ApiZodOk(verifyEmailResponseSchema, 'Consume one-time email verification without changing account access')
  confirmEmailVerification(
    @Body(new ZodValidationPipe(verifyEmailRequestSchema)) body: { token: string },
    @Req() request: Request,
  ) {
    return this.verification.verify(body.token, request.ip || request.socket.remoteAddress || 'unknown');
  }

  @Get('session')
  @ApiBearerAuth()
  @ApiZodOk(
    authSessionResponseSchema,
    'Current authenticated identity',
  )
  session(
    @Req()
    request: RequestWithIdentity,
  ) {
    return this.authService.session(
      request.user as AppIdentity,
    );
  }

  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'C03 authenticated self account details without secrets' })
  @ApiZodOk(accountDetailSchema, 'Current account profile and effective access')
  profile(@Req() request: RequestWithIdentity) {
    return this.accounts.detail(request.user!.id, request.user as AppIdentity);
  }

  @Post('change-password')
  @ApiZodOk(accountPasswordResultSchema, 'Password changed; refresh sessions revoked')
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiZodBody(
    changePasswordRequestSchema,
  )
  changePassword(
    @Body(
      new ZodValidationPipe(
        changePasswordRequestSchema,
      ),
    )
    body: ChangePasswordRequest,
    @Req()
    request: RequestWithIdentity,
  ) {
    return this.authService.changePassword(
      request.user as AppIdentity,
      body.currentPassword,
      body.newPassword,
    );
  }

  @Post('update-profile')
  @ApiZodOk(accountProfileResultSchema, 'Updated safe session identity')
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiZodBody(
    updateProfileRequestSchema,
  )
  updateProfile(
    @Body(
      new ZodValidationPipe(
        updateProfileRequestSchema,
      ),
    )
    body: UpdateProfileRequest,
    @Req()
    request: RequestWithIdentity,
  ) {
    return this.authService.updateProfile(
      request.user as AppIdentity,
      body,
    );
  }
}
