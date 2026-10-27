import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AUTH_ACCESS_KEY,
  AUTH_ROLES_KEY,
  CMS_SCREEN_KEY,
  type AuthAccessMode,
} from './auth.decorators.js';
import { AuthIdentityService } from './auth-identity.service.js';
import type { RequestWithIdentity } from './auth.types.js';

@Injectable()
export class SecurityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authIdentity: AuthIdentityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithIdentity>();
    const authorization =
      request.headers?.authorization || request.headers?.Authorization;

    const identity =
      await this.authIdentity.resolveAuthorizationHeader(authorization);

    if (identity) {
      request.user = identity;
      request.authMode = identity.authMode;
    }

    const access =
      this.reflector.getAllAndOverride<AuthAccessMode>(AUTH_ACCESS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || 'authenticated';

    if (access === 'optional-auth') {
      // A supplied expired/blocked session must not silently create a guest record.
      if (authorization) this.authIdentity.assertActive(identity);
      return true;
    }

    if (access === 'public') {
      return true;
    }

    if (
      access === 'public-read' &&
      String(request.query?.scope || 'public').toLowerCase() !== 'cms'
    ) {
      return true;
    }

    let activeIdentity;
    try {
      activeIdentity = this.authIdentity.assertActive(identity);
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new UnauthorizedException({
        success: false,
        error: 'Yêu cầu đăng nhập để thực hiện thao tác này.',
      });
    }

    const allowedRoles =
      this.reflector.getAllAndOverride<string[]>(AUTH_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (
      allowedRoles.length > 0 &&
      !allowedRoles.includes(activeIdentity.roleCode)
    ) {
      throw new ForbiddenException({
        success: false,
        error: 'Bạn không có vai trò phù hợp để thực hiện thao tác này.',
      });
    }

    const cmsScreen =
      this.reflector.getAllAndOverride<string>(CMS_SCREEN_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    if (
      cmsScreen &&
      !activeIdentity.allowedScreens.includes('*') &&
      !activeIdentity.allowedScreens.includes(cmsScreen)
    ) {
      throw new ForbiddenException({
        success: false,
        error: 'Tài khoản không có quyền truy cập chức năng này.',
      });
    }

    return true;
  }
}
