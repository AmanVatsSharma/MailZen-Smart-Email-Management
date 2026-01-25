import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser = require('cookie-parser');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Parse cookies early so GraphQL resolvers/guards can reliably read them.
  // This is required for HttpOnly cookie-based sessions.
  app.use(cookieParser());

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
