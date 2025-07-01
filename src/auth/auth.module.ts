import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config'; // ConfigModule, ConfigService 추가
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from 'src/users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    // JwtModule을 비동기 방식으로 등록합니다.
    JwtModule.registerAsync({
      imports: [ConfigModule], // ConfigModule을 import
      inject: [ConfigService], // ConfigService를 주입
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'), // .env 파일의 JWT_SECRET 사용
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
})
export class AuthModule {}
