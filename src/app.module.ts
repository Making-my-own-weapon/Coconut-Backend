import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { EditorModule } from './editor/editor.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // ignoreEnvFile: true, // env_file로만 환경변수 로딩
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
        retryAttempts: 10,
        retryDelay: 3000,

        namingStrategy: new SnakeNamingStrategy(),
      }),
    }),
    EditorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
