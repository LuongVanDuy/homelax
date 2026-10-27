import 'reflect-metadata';
import express from 'express';
import { NestFactory } from '@nestjs/core';
import {
  ExpressAdapter,
} from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import {
  configureApplication,
  setupSwagger,
} from './bootstrap/app-bootstrap.js';

const server = express();
let bootstrapPromise: Promise<void> | null =
  null;

async function ensureBootstrapped() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const app = await NestFactory.create(
        AppModule,
        new ExpressAdapter(server),
        {
          cors: false,
      bodyParser: false,
          logger: false,
        },
      );

      configureApplication(app);
      setupSwagger(app);

      await app.init();
    })();
  }

  await bootstrapPromise;
}

export default async function handler(
  request: any,
  response: any,
) {
  await ensureBootstrapped();
  return (server as any)(request, response);
}
