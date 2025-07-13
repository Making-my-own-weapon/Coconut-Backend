import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubmissionController } from './submission.controller';
import { SubmissionService } from './submission.service';
import { Submission } from './entities/submission.entity';
import { Testcase } from './entities/testcase.entity';
import { Problem } from '../problems/entities/problem.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Submission, Testcase, Problem])],
  controllers: [SubmissionController],
  providers: [SubmissionService],
  exports: [SubmissionService], // 다른 모듈에서 사용할 수 있도록 export
})
export class SubmissionModule {}
