import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: true }));

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3002',
      'http://localhost:3005',
    ],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
void bootstrap();
