import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // .env의 PORT 변수를 사용하고, 없으면 3001번 포트 사용
  // '0.0.0.0'으로 외부 접속 허용 (Docker 컨테이너 외부에서 접속하기 위함)
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
void bootstrap();
