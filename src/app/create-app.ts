import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { IncomingMessage } from 'node:http';
import type { Http2ServerRequest } from 'node:http2';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppError } from '../common/errors/app-error.js';
import { HttpErrorFilter } from '../common/errors/http-error.filter.js';
import { selectRequestId } from '../common/http/request-id.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import { AppModule } from './app.module.js';

const GLOBAL_RATE_LIMIT_MAX = 100;

export async function createApp(config: RuntimeConfig): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register(config),
    new FastifyAdapter({
      genReqId: (request: IncomingMessage | Http2ServerRequest) =>
        selectRequestId(request.headers['x-request-id']),
    }),
    { logger: false },
  );

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpErrorFilter());
  const fastify = app.getHttpAdapter().getInstance();
  await fastify.register(cookie);
  await fastify.register(cors, {
    origin: config.frontendOrigin,
    credentials: true,
  });
  await fastify.register(helmet);
  await fastify.register(rateLimit, {
    max: GLOBAL_RATE_LIMIT_MAX,
    timeWindow: 60_000,
    errorResponseBuilder: () => new AppError('RATE_LIMITED', 429, 'Too many requests'),
  });
  fastify.addHook('onSend', (request, reply, payload, done) => {
    void reply.header('x-request-id', request.id);
    done(null, payload);
  });
  if (config.nodeEnv !== 'production') {
    const openApiConfig = new DocumentBuilder()
      .setTitle('IoT Soil Monitoring API')
      .setDescription('Role 3 backend contract for the Role 2 web application')
      .setVersion('0.1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
      .build();
    const openApiDocument = SwaggerModule.createDocument(app, openApiConfig);
    SwaggerModule.setup('/docs', app, openApiDocument, {
      jsonDocumentUrl: '/docs-json',
      raw: ['json'],
      customSiteTitle: 'IoT API Documentation',
    });
  }
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}
