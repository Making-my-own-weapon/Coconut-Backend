import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: true }));
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
void bootstrap();
