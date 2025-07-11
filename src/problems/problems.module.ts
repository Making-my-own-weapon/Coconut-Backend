import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProblemsController } from './problems.controller';
import { ProblemsService } from './problems.service';
import { Problem } from './entities/problem.entity';
import { RoomProblem } from './entities/room-problem.entity';
import { Testcase } from './entities/testcase.entity';
import { Room } from '../rooms/entities/room.entity'; // ← 추가
import { EditorModule } from '../editor/editor.module'; // ← 추가

@Module({
  imports: [
    TypeOrmModule.forFeature([Problem, RoomProblem, Testcase, Room]),
    EditorModule,
  ], // ← EditorModule 추가
  controllers: [ProblemsController],
  providers: [ProblemsService],
})
export class ProblemsModule {}
