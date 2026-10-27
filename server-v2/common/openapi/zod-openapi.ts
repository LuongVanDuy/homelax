import {
  applyDecorators,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  apiErrorSchema,
} from '@tinyhouse/contracts';
import {
  z,
  type ZodType,
} from 'zod';

export function zodJsonSchema(
  schema: ZodType,
) {
  const json = z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io: 'input',
    unrepresentable: 'any',
  }) as Record<string, unknown>;

  delete json.$schema;

  return json;
}

export function ApiZodBody(
  schema: ZodType,
) {
  return ApiBody({
    required: true,
    schema: zodJsonSchema(schema) as any,
  });
}

export function ApiZodOk(
  schema: ZodType,
  description = 'Successful response',
) {
  return ApiOkResponse({
    description,
    schema: zodJsonSchema(schema) as any,
  });
}

export function ApiStandardErrors() {
  const errorSchema =
    zodJsonSchema(apiErrorSchema) as any;

  return applyDecorators(
    ApiBadRequestResponse({
      description: 'Invalid request contract',
      schema: errorSchema,
    }),
    ApiUnauthorizedResponse({
      description: 'Authentication required or invalid',
      schema: errorSchema,
    }),
    ApiForbiddenResponse({
      description: 'Authenticated but not authorized',
      schema: errorSchema,
    }),
    ApiInternalServerErrorResponse({
      description: 'Unexpected server error',
      schema: errorSchema,
    }),
  );
}
