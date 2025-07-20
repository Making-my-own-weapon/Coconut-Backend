import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { SavedReport } from './entities/saved-report.entity';
import { Room } from '../rooms/entities/room.entity';
import { RoomProblem } from '../problems/entities/room-problem.entity';
import { Problem } from '../problems/entities/problem.entity';
import { Submission } from '../submissions/entities/submission.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SavedReport,
      Room,
      RoomProblem,
      Problem,
      Submission,
      User,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
