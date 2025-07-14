import { Module, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProblemsModule } from './problems/problems.module';
import { RoomsModule } from './rooms/rooms.module';
import { SubmissionModule } from './submissions/submission.module';
import { APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
//import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { EditorModule } from './editor/editor.module';
import { AnalysisModule } from './analysis/analysis.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
      //ignoreEnvFile: true, // env_file로만 환경변수 로딩
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'mysql' as const,
        url: `mysql://${cfg.get<string>('DB_USERNAME')}:${cfg.get<string>(
          'DB_ROOT_PASSWORD',
        )}@${cfg.get<string>('DB_HOST')}:${cfg.get<number>(
          'DB_PORT',
        )}/${cfg.get<string>('DB_DATABASE')}?charset=utf8mb4`,
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: cfg.get<string>('DB_SYNCHRONIZE') === 'true', // dev only
        retryAttempts: 20,
        retryDelay: 3000,

        // namingStrategy: new SnakeNamingStrategy(),
      }),
    }),
    AuthModule,
    UsersModule,
    EditorModule,
    ProblemsModule,
    RoomsModule,
    UsersModule,
    SubmissionModule,
    AnalysisModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_PIPE, // 전역 파이프 설정
      useClass: ValidationPipe,
    },
  ],
})
export class AppModule {}
