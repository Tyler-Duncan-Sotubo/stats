import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { ValidationPipe } from '@nestjs/common';
import fastifyCompress from '@fastify/compress';
import fastifyCookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { V1Module } from './modules/v1/v1.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false, bodyLimit: 10 * 1024 * 1024 }),
    {
      bufferLogs: true,
      bodyParser: false,
    },
  );

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');

  const fastify = app.getHttpAdapter().getInstance();

  await fastify.register(multipart as any, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  await fastify.register(fastifyCompress as any);

  await fastify.register(fastifyCookie as any, {
    secret: process.env.COOKIE_SECRET,
  });

  fastify.addHook('onRequest', (request: any, reply: any, done: any) => {
    if (request.url.startsWith('/api/v1')) {
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      reply.header(
        'Access-Control-Allow-Headers',
        'Authorization, Content-Type',
      );
    }
    done();
  });

  app.enableCors({
    origin: [
      process.env.CLIENT_URL,
      'http://localhost:3000',
      'https://stats-client-production.up.railway.app',
      'https://developers.tooxclusive.com', // add this
    ].filter((url): url is string => typeof url === 'string'),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // ── Swagger ───────────────────────────────────────────────────────────────

  const config = new DocumentBuilder()
    .setTitle('TooXclusive API')
    .setDescription(
      'The official TooXclusive music data API — streaming stats, milestones, charts and more for 20,000+ artists and 1.2M songs.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
        description: 'Enter your API key: txc_live_...',
      },
      'api-key',
    )
    .setContact(
      'TooXclusive',
      'https://developers.tooxclusive.com',
      'api@tooxclusive.com',
    )
    .setLicense('Proprietary', 'https://tooxclusive.com/terms')
    .addServer('https://api.tooxclusive.com', 'Production')
    .addServer('http://localhost:8000', 'Local')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    include: [V1Module],
  });

  // Serve JSON spec
  fastify.get('/api/docs-json', (req: any, reply: any) => {
    reply.type('application/json').send(document);
  });

  // Serve Swagger UI via CDN — bypasses @fastify/static requirement
  const swaggerHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>TooXclusive API Docs</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css">
      <style>
        html { box-sizing: border-box; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin: 0; background: #fafafa; }
        .swagger-ui .topbar { background-color: #000; }
        .swagger-ui .topbar .download-url-wrapper { display: none; }
      </style>
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.min.js"></script>
      <script>
        window.onload = function() {
          window.ui = SwaggerUIBundle({
            url: '/api/docs-json',
            dom_id: '#swagger-ui',
            presets: [
              SwaggerUIBundle.presets.apis,
              SwaggerUIStandalonePreset
            ],
            layout: 'StandaloneLayout',
            persistAuthorization: true,
             requestInterceptor: (request) => {
          if (!request.headers.Authorization) {
            request.headers.Authorization = 'Bearer txc_live_3dc60c18580d20075706a1b45084bff6dd969d8fcd49cb42b5e7b5b39a65739f';
          }
          return request;
        },
          });
        };
      </script>
    </body>
    </html>
  `;

  fastify.get('/api/docs', (req: any, reply: any) => {
    reply.type('text/html').send(swaggerHtml);
  });

  // ── Start ─────────────────────────────────────────────────────────────────

  const port = process.env.PORT || 8000;
  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`🚀 Listening on port ${port}`);
}

void bootstrap();
