// src/problems/entities/testcase.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Problem } from './problem.entity';

@Entity('testcases')
export class Testcase {
  @PrimaryGeneratedColumn({ name: 'testcase_id' }) id: number;

  @ManyToOne(() => Problem, (problem) => problem.testcases, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'problem_id' })
  problem: Problem;

  @Column({ type: 'varchar', length: 255 }) inputTc: string;
  @Column({ type: 'varchar', length: 255 }) outputTc: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
