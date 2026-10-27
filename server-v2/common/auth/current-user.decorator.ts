import {
  createParamDecorator,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { RequestWithIdentity } from './auth.types.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const identity = context.switchToHttp()
      .getRequest<RequestWithIdentity>().user;

    if (!identity) {
      throw new UnauthorizedException('Yêu cầu đăng nhập để thực hiện thao tác này.');
    }

    return identity;
  },
);
