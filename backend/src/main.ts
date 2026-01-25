import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // Fail fast on unsafe/missing configuration (enterprise-grade default).
  // Keeping this here avoids scattered runtime failures later.
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.trim().length < 32) {
    // 32+ chars is a practical minimum; adjust as needed.
    throw new Error('JWT_SECRET is missing/too short. Set a strong JWT_SECRET (>= 32 chars) in backend/.env');
  }

  const app = await NestFactory.create(AppModule);

  // Configure CORS to allow requests from the frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  
  await app.listen(process.env.PORT || 4000);
}
bootstrap();
