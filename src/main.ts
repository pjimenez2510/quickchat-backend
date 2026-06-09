import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { DecryptRequestInterceptor } from './common/interceptors/decrypt-request.interceptor';
import { EncryptResponseInterceptor } from './common/interceptors/encrypt-response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Quita "X-Powered-By: Express"
  app.disable('x-powered-by');

  // Middleware para suprimir headers reveladores y forzar no-cache en APIs
  app.use((_req: unknown, res: {
    removeHeader: (h: string) => void;
    setHeader: (h: string, v: string) => void;
  }, next: () => void) => {
    res.removeHeader('Server');
    res.removeHeader('X-Powered-By');
    // Endpoints de API nunca deben cachearse — contienen datos del usuario
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  // Helmet: cabeceras de seguridad estándar (CSP, X-Frame-Options, nosniff, HSTS, etc.)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      strictTransportSecurity: {
        maxAge: 31536000,
        includeSubDomains: true,
      },
      xContentTypeOptions: true,
      xFrameOptions: { action: 'deny' },
      xPoweredBy: false,
    }),
  );

  app.enableCors({
    origin: process.env['CORS_ORIGINS']?.split(',').map((s) => s.trim()) ?? [
      'http://localhost:3000',
    ],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'ngrok-skip-browser-warning',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // No exponer ningún header personalizado al navegador
    exposedHeaders: [],
    // Cache del preflight: reduce verbosidad en headers
    maxAge: 600,
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global interceptors (solo HTTP — useGlobalInterceptors NO aplica a gateways
  // WebSocket. El WsCryptoInterceptor se registra vía APP_INTERCEPTOR en AppModule).
  // NestJS aplica los .map en orden INVERSO. Con [Decrypt, Encrypt, Transform]:
  //   Response: handler → Transform.map (envuelve) → Encrypt.map (cifra) → Decrypt.map (no-op)
  //   Request:  Decrypt (descifra body) → resto skip → handler
  app.useGlobalInterceptors(
    new DecryptRequestInterceptor(),
    new EncryptResponseInterceptor(),
    new TransformResponseInterceptor(),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger - only in non-production
  if (process.env['NODE_ENV'] !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('QuickChat API')
      .setDescription('QuickChat messaging API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);
}
bootstrap().catch((err: unknown) => {
  console.error('Failed to start application', err);
  process.exit(1);
});
