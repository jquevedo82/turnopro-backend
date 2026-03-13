/**
 * main.ts — Bootstrap del servidor NestJS
 * Para cambiar puerto: modificar PORT en .env
 * Para agregar orígenes CORS: agregar al array origins
 */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { appConfig } from './config/app.config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Servir archivos estáticos (solo necesario con STORAGE=local)
  if (process.env.STORAGE === 'local') {
    app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });
  }
  // Para agregar más orígenes CORS: agregar al array origins
  const origins = [
    'http://localhost:5173',
    'http://localhost:3001',
    appConfig.app.url,           // ✅ ya es string, no undefined
  ].filter(Boolean);             // elimina duplicados vacíos

  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  await app.listen(appConfig.app.port);
  console.log(`🚀 TurnoPro API corriendo en: http://localhost:${appConfig.app.port}/api`);
}

bootstrap();
