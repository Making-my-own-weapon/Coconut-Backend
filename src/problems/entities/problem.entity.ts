import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { RoomProblem } from './room-problem.entity';
import { Testcase } from './testcase.entity';
import { Submission } from '../../submissions/entities/submission.entity';

/** 출처(Enum) 정의 */
export enum ProblemSource {
  MY = 'My',
  BOJ = 'BOJ',
}

@Entity('problems')
export class Problem {
  @PrimaryGeneratedColumn({ name: 'problem_id' })
  problemId: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  // 문제 등록자 (creator_id FK → users.user_id)
  @ManyToOne(() => User, (user) => user.createdProblems)
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @Column({ name: 'execution_time_limit_ms', type: 'int' })
  executionTimeLimitMs: number;

  @Column({ name: 'memory_limit_kb', type: 'int' })
  memoryLimitKb: number;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'solve_time_limit_min', type: 'int', nullable: true })
  solveTimeLimitMin: number;

  // 출처(My vs BOJ)
  @Column({
    type: 'enum',
    enum: ProblemSource,
    default: ProblemSource.MY,
  })
  source: ProblemSource;

  // 카테고리 배열 (JSON)
  @Column({ type: 'json' })
  categories: string[];

  // 예시 테스트케이스 (JSON)
  @Column({ name: 'example_tc', type: 'json', nullable: true })
  exampleTc: string;

  // 테스트케이스 (testcases.problem_id → problems.problem_id)
  @OneToMany(() => Testcase, (tc) => tc.problem, { cascade: true })
  testcases: Testcase[];

  // 방에 할당된 링크 (room_problems)
  @OneToMany(() => RoomProblem, (rp) => rp.problem)
  roomLinks: RoomProblem[];

  // 제출 기록
  @OneToMany(() => Submission, (sub) => sub.problem)
  submissions: Submission[];

  @Column({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
