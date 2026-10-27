import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import express from 'express';
import { isIP } from 'node:net';
import path from 'node:path';
import { AppModule } from './app.module.js';
import { configureApplication } from './bootstrap/app-bootstrap.js';

// A built, same-origin preview. Only cloudflared on this computer reaches this listener.
const origin = new URL(process.env.PUBLIC_APP_URL || '');
if (origin.protocol !== 'https:') throw new Error('Tunnel preview requires an HTTPS PUBLIC_APP_URL.');
const app = await NestFactory.create(AppModule, { cors: false, bodyParser: false, logger: ['error', 'warn'] });
app.use((request: express.Request, response: express.Response, next: express.NextFunction) => {
  response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  // Cloudflare supplies this header; discard the client's forwarded chain.
  const visitor = request.get('cf-connecting-ip');
  delete request.headers['x-forwarded-for'];
  if (visitor && isIP(visitor)) request.headers['x-forwarded-for'] = visitor;
  request.headers['x-forwarded-proto'] = 'https';
  if (request.get('origin') && request.get('origin') !== origin.origin) {
    response.status(403).json({ success: false, error: 'Nguồn truy cập không được phép.' });
    return;
  }
  // Do not expose developer documentation through the public preview.
  if (request.path.split('/').some(part => part.startsWith('.')) || /^\/api\/v2\/docs(?:\/|-|$)/.test(request.path)) {
    response.sendStatus(404); return;
  }
  next();
});
configureApplication(app);
const webRoot = path.resolve('dist');
const staticFiles = express.static(webRoot, { index: false, dotfiles: 'deny', maxAge: 0 });
app.use((request: express.Request, response: express.Response, next: express.NextFunction) => {
  if (/^\/(api|uploads)(\/|$)/.test(request.path)) return next();
  staticFiles(request, response, (error?: unknown) => {
    if (error) return next(error);
    if (!['GET', 'HEAD'].includes(request.method) || path.extname(request.path)) return next();
    response.sendFile(path.join(webRoot, 'index.html'));
  });
});
app.enableShutdownHooks();
await app.listen(Number(process.env.TUNNEL_PORT || 5180), '127.0.0.1');
console.log(`[Tiny Houses] Bản kiểm thử sẵn sàng tại ${origin.origin}`);
