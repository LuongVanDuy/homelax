import cookieParser from 'cookie-parser';
import express from 'express';
import { isIP } from 'node:net';
import type {
  INestApplication,
} from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';
import type {
  OpenAPIObject,
} from '@nestjs/swagger';
import { runtimeConfig } from '../config/runtime-config.js';
import { uploadsDirectory } from '../config/uploads-directory.js';
import {
  HttpExceptionFilter,
} from '../common/filters/http-exception.filter.js';
import {
  VersionBumpInterceptor,
} from '../common/interceptors/version-bump.interceptor.js';
import {
  securityHeaders,
} from '../common/http/security-headers.js';

export function configureApplication(
  app: INestApplication,
) {
  // Only explicit proxy IPs/CIDRs may supply a client IP; never trust arbitrary X-Forwarded-For.
  const proxies = String(process.env.TRUSTED_PROXY_CIDRS || '').split(',').map(value => value.trim()).filter(Boolean);
  for (const proxy of proxies) {
    const [address, prefix, extra] = proxy.split('/');
    const version = isIP(address);
    if (!version || extra !== undefined || (prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) > (version === 4 ? 32 : 128)))) {
      throw new Error('TRUSTED_PROXY_CIDRS must contain explicit proxy IP addresses or CIDRs.');
    }
  }
  app.getHttpAdapter().getInstance().set('trust proxy', proxies.length ? proxies : false);
  app.setGlobalPrefix(
    runtimeConfig.globalPrefix,
  );

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  app.use(
    '/uploads',
    express.static(
      uploadsDirectory(),
      {
        maxAge: '1d',
        immutable: false,
      },
    ),
  );

  app.use(cookieParser());
  app.use(securityHeaders);
  app.useGlobalFilters(
    new HttpExceptionFilter(),
  );
  app.useGlobalInterceptors(
    new VersionBumpInterceptor(),
  );

  return app;
}

export function createOpenApiDocument(
  app: INestApplication,
): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Tiny House API v2')
    .setDescription(
      'NestJS v2 API backed by PostgreSQL with JWT access/refresh authentication.',
    )
    .setVersion('2.0')
    .addBearerAuth()
    .build();

  return SwaggerModule.createDocument(
    app,
    config,
  );
}

export function setupSwagger(
  app: INestApplication,
) {
  SwaggerModule.setup(
    runtimeConfig.swaggerPath,
    app,
    () => createOpenApiDocument(app),
    {
      useGlobalPrefix: true,
    },
  );
}
