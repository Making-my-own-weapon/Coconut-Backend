import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 모든 모듈에서 .env 변수를 사용할 수 있게 함
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
