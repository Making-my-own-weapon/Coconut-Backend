// src/rooms/rooms.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { Room } from './entities/room.entity';
import { RoomProblem } from '../problems/entities/room-problem.entity';
import { Problem } from '../problems/entities/problem.entity';
import { Submission } from '../submissions/entities/submission.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Room, RoomProblem, Problem, Submission])],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
