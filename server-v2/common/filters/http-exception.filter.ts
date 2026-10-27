import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type {
  Request,
  Response,
} from 'express';

function errorMessage(
  payload: unknown,
  fallback: string,
) {
  if (typeof payload === 'string') {
    return payload;
  }

  if (
    payload &&
    typeof payload === 'object'
  ) {
    const record =
      payload as Record<string, unknown>;

    if (
      typeof record.error === 'string' &&
      record.error.trim()
    ) {
      return record.error;
    }

    if (
      typeof record.message === 'string' &&
      record.message.trim()
    ) {
      return record.message;
    }

    if (Array.isArray(record.message)) {
      return record.message
        .map(String)
        .join('; ');
    }
  }

  return fallback;
}

@Catch()
export class HttpExceptionFilter
  implements ExceptionFilter
{
  catch(
    exception: unknown,
    host: ArgumentsHost,
  ) {
    const http = host.switchToHttp();
    const response =
      http.getResponse<Response>();
    const request =
      http.getRequest<Request>();

    const timestamp =
      new Date().toISOString();
    const path =
      request.originalUrl ||
      request.url ||
      '';

    if (
      exception instanceof HttpException
    ) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const objectPayload =
        raw &&
        typeof raw === 'object' &&
        !Array.isArray(raw)
          ? {
              ...(raw as Record<
                string,
                unknown
              >),
            }
          : {};

      const fallback =
        status >= 500
          ? 'Internal Server Error'
          : exception.message;

      response.status(status).json({
        ...objectPayload,
        success: false,
        error: errorMessage(
          raw,
          fallback,
        ),
        timestamp,
        path,
      });

      return;
    }

    const error = exception as Error;

    response
      .status(
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
      .json({
        success: false,
        error:
          process.env.NODE_ENV ===
          'production'
            ? 'Internal Server Error'
            : error?.message ||
              'Internal Server Error',
        timestamp,
        path,
      });
  }
}
