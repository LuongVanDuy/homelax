import './environment.js';

export const runtimeConfig = {
  port: Number(process.env.NEST_PORT || 5001),
  host: process.env.NEST_HOST || '0.0.0.0',
  globalPrefix: 'api/v2',
  swaggerPath: 'docs',
} as const;
