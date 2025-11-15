/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app/app.module';
import { join } from 'path';
import session from "express-session";
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix, {
    exclude: [
      'member/login',
      'member/dashboard',
      'member/transactions',
      'member/sessions/:sessionId/revoke',
      'member/logout',
    ],
  });

  // Register global exception filter for consistent error responses
  app.useGlobalFilters(new HttpExceptionFilter());

  // Register global interceptor for wrapping successful responses
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  // Configure Pug template engine
  app.setBaseViewsDir(join(__dirname, 'views'));
  app.setViewEngine('pug');

  // Serve static files (CSS, images, etc.)
  app.useStaticAssets(join(__dirname, 'public'));

  // Configure session middleware for OAuth flow
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'dev-session-secret-please-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 3600000, // 1 hour
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      },
    })
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
