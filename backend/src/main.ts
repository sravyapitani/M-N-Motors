import './polyfills';
import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global prefix so all endpoints are exposed under /api
  app.setGlobalPrefix('api');

  // Enforce DTO request validation and payload transformation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Restrict CORS to frontend origin (default: http://localhost:5173)
  const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
  app.enableCors({
    origin: frontendOrigin,
    credentials: true,
  });

  // Enable NestJS lifecycle shutdown hooks so PrismaService disconnects cleanly
  app.enableShutdownHooks();

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port);
  console.log(`Nexus ERP Backend is running on: http://localhost:${port}/api`);
}

bootstrap();
