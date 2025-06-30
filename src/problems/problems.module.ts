import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProblemsController } from './problems.controller';
import { ProblemsService } from './problems.service';
import { Problem } from './entities/problem.entity';
import { RoomProblem } from './entities/room-problem.entity';
import { Testcase } from './entities/testcase.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Problem, RoomProblem, Testcase])],
  controllers: [ProblemsController],
  providers: [ProblemsService],
})
export class ProblemsModule {}
