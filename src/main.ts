import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggerService } from './common/logger/logger.service';

async function bootstrap() {
  const port = process.env.PORT || 3000;
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
    rawBody: true,
  });

  const loggerService = app.get(LoggerService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );
  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter(loggerService));

  app.enableCors({
    origin: true,
    credentials: true,
  });

  // ------------------------------------------------------------------
  // TEMPORARILY DISABLED: Redis Adapter
  // ------------------------------------------------------------------
  // const redisAdapter = new RedisIoAdapter(app);
  // await redisAdapter.connectToRedis();
  // app.useWebSocketAdapter(redisAdapter);

  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Application is running on: http://localhost:${port}`);
}
bootstrap();
