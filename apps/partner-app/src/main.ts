/**
 * Partner Application - Demonstrates OAuth2.0 integration with Points Bank
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app/app.module';
import { join } from 'path';
import session from 'express-session';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Configure Pug template engine
  app.setBaseViewsDir(join(__dirname, 'views'));
  app.setViewEngine('pug');

  // Serve static files
  app.useStaticAssets(join(__dirname, 'public'));

  // Configure session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'partner-session-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 3600000, // 1 hour
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      },
    })
  );

  const port = process.env.PORT || 4200;
  await app.listen(port);
  Logger.log(
    `🚀 Partner App is running on: http://localhost:${port}`
  );
}

bootstrap();
