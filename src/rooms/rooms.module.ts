// src/rooms/rooms.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { Room } from './entities/room.entity';
import { RoomProblem } from '../problems/entities/room-problem.entity';
import { Problem } from '../problems/entities/problem.entity';
import { UsersModule } from '../users/users.module';
import { Submission } from '../submissions/entities/submission.entity'; //리포트 페이지가 생긴 이후로 이게 없으면 회원가입도 로그인도 안됩니다

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, RoomProblem, Problem, Submission]), //Submission 있어야 한다. 『안채호』
    UsersModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
