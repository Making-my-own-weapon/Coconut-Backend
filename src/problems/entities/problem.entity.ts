import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity'; // 사용자 엔티티 경로 조정
import { RoomProblem } from './room-problem.entity';
import { Testcase } from './testcase.entity';
import { Submission } from '../../submissions/entities/submission.entity';

@Entity('problems')
export class Problem {
  @PrimaryGeneratedColumn({ name: 'problem_id' })
  problemId: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  // 문제 등록자 (creator_id FK → users.id)
  @ManyToOne(() => User, (user) => user.createdProblems)
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @Column({ type: 'int' })
  executionTimeLimitMs: number;

  @Column({ type: 'int' })
  memoryLimitKb: number;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'int', nullable: true })
  solveTimeLimitMin: number;

  // 테스트케이스 (testcases.problem_id → problems.problemId)
  @OneToMany(() => Testcase, (tc) => tc.problem)
  testcases: Testcase[];

  // 방에 할당된 링크 (room_problems)
  @OneToMany(() => RoomProblem, (rp) => rp.problem)
  roomLinks: RoomProblem[];

  // 제출 기록
  @OneToMany(() => Submission, (sub) => sub.problem)
  submissions: Submission[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
