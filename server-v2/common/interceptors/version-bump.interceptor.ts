import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  bumpSystemDataVersion,
} from '../version/system-version.js';

const MUTATION_METHODS = new Set([
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]);

@Injectable()
export class VersionBumpInterceptor
  implements NestInterceptor
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request =
      context.switchToHttp().getRequest<any>();

    return next.handle().pipe(
      tap(() => {
        if (
          MUTATION_METHODS.has(
            String(request.method || '').toUpperCase(),
          )
        ) {
          bumpSystemDataVersion();
        }
      }),
    );
  }
}
