import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app/app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { WinstonLoggerService } from './common/logger/winston-logger.service';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import morgan from 'morgan';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import { StartupService } from './startup.service';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import {
  API_PREFIX,
  DEFAULT_PORT,
  SERVICE_NAME,
  SWAGGER_PATH,
} from './app.constants';
import { isSwaggerEnabled, validateEnv } from './config/env.validation';

/**
 * Boots the NestJS application: validates configuration, configures proxy
 * trust, versioning, Swagger, CORS, validation, request-scoped Winston/Morgan
 * logging and the MikroORM request context, applies pending migrations, then
 * starts listening.
 */
async function bootstrap() {
  // Before anything opens a connection. A service with missing or malformed
  // required configuration must fail here, saying what is wrong, rather than
  // half-starting and failing somewhere that looks unrelated.
  const env = validateEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const winstonLoggerService = app.get(WinstonLoggerService);
  app.useLogger(winstonLoggerService.getNestLogger());

  // Only when the deployment says how many proxies are actually in front of
  // this process. Express then walks that many hops back from the right of
  // X-Forwarded-For, so `req.ip` — the address the access log below records —
  // is what the outermost trusted proxy observed rather than the proxy itself.
  //
  // Left unset, `req.ip` is the socket peer: behind a reverse proxy that is
  // the proxy, so every client appears in the log as one address. Setting it
  // to `true` instead of a count is the dangerous option — `req.ip` becomes
  // the leftmost X-Forwarded-For entry, which the caller writes, so any client
  // can put whatever address it likes in your logs. It also changes
  // `req.protocol`, `req.secure`, and `req.hostname`.
  if (env.TRUST_PROXY_HOPS !== undefined) {
    app.set('trust proxy', env.TRUST_PROXY_HOPS);
  }
  // Probes stay at /health and /ready, outside the prefix and outside URI
  // versioning, so their URLs do not move when the service is renamed or the
  // API is versioned.
  app.setGlobalPrefix(API_PREFIX, { exclude: ['health', 'ready'] });
  // Lets readiness flip to 503 on SIGTERM before Nest starts closing.
  app.enableShutdownHooks();
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: ['1'],
  });

  const port = env.PORT ?? DEFAULT_PORT;

  app.enableCors({
    origin: env.CORS_ORIGINS,
    // `credentials` stays off. On a Bearer-token API it does nothing, and it
    // is precisely the flag that would turn origin reflection into a real
    // vulnerability if cookie auth were added later. Turn it on only
    // alongside actual cookie auth and CSRF protection.
    exposedHeaders: ['Content-Disposition'],
  });
  app.use(helmet({ contentSecurityPolicy: false }));
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(app.get(AllExceptionsFilter));

  app.use(requestIdMiddleware);
  const morganMiddleware = morgan(
    ':remote-addr :method :url :status :res[content-length] - :response-time ms',
    {
      stream: {
        // Configure Morgan to use our custom logger with the http severity
        write: (message) =>
          winstonLoggerService
            .getLogger()
            .child({ label: 'API' })
            .http(message.trim()),
      },
    },
  );
  app.use(morganMiddleware);

  const orm = app.get(MikroORM);
  app.use(function (req: Request, res: Response, next: NextFunction) {
    RequestContext.create(orm.em, next);
  });

  // Register Swagger after the shared HTTP middleware so the docs UI and JSON
  // routes receive the same security headers, request ID, and access logging
  // as the rest of the application.
  if (isSwaggerEnabled(env)) {
    const config = new DocumentBuilder()
      .setTitle(SERVICE_NAME)
      .setDescription(`${SERVICE_NAME} API documentation`)
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(SWAGGER_PATH, app, document, {
      customSiteTitle: `${SERVICE_NAME} API docs`,
    });
  }

  // Apply committed migrations before starting the app. Seeding is NOT run
  // here on purpose — see `npm run seed`.
  await RequestContext.create(orm.em, async () => {
    await app.get(StartupService).initialize();
  });

  await app.listen(port, () => {
    winstonLoggerService.getLogger().info('service_bootstrap_complete', {
      label: 'Bootstrap',
      service: SERVICE_NAME,
      port,
      apiPrefix: API_PREFIX,
      swaggerPath: isSwaggerEnabled(env) ? SWAGGER_PATH : null,
      nodeEnv: env.NODE_ENV,
      logLevel: env.LOG_LEVEL ?? 'http',
      trustProxyHops: env.TRUST_PROXY_HOPS ?? 0,
    });
  });
}

// Anything that goes wrong during boot — invalid configuration, an
// unreachable database, a migration that will not apply — must stop the
// process. A service that half-starts is worse than one that does not start.
bootstrap().catch((error) => {
  Logger.error(
    'Error starting application:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
