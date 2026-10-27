import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { runtimeConfig } from './config/runtime-config.js';
import {
  configureApplication,
  setupSwagger,
} from './bootstrap/app-bootstrap.js';

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
    {
      cors: false,
      bodyParser: false,
    },
  );

  configureApplication(app);
  setupSwagger(app);

  await app.listen(
    runtimeConfig.port,
    runtimeConfig.host,
  );

  console.log(
    '[Nest v2] listening on http://localhost:' +
      runtimeConfig.port +
      '/' +
      runtimeConfig.globalPrefix,
  );

  console.log(
    '[Nest v2] Swagger: http://localhost:' +
      runtimeConfig.port +
      '/' +
      runtimeConfig.globalPrefix +
      '/' +
      runtimeConfig.swaggerPath,
  );
}

await bootstrap();
