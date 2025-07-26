import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProblemsController } from './problems.controller';
import { ProblemsService } from './problems.service';
import { Problem } from './entities/problem.entity';
import { RoomProblem } from './entities/room-problem.entity';
import { Testcase } from './entities/testcase.entity';
import { Room } from '../rooms/entities/room.entity'; // ← 추가
import { EditorModule } from '../editor/editor.module'; // ← 추가
import { S3Service } from '../common/s3.service'; // S3 서비스 추가

@Module({
  imports: [
    TypeOrmModule.forFeature([Problem, RoomProblem, Testcase, Room]),
    EditorModule,
  ], // ← EditorModule 추가
  controllers: [ProblemsController],
  providers: [ProblemsService, S3Service], // S3 서비스 등록
})
export class ProblemsModule {}
