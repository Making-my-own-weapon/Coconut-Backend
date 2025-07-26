import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Problem } from '../../problems/entities/problem.entity';

@Entity('testcases')
export class Testcase {
  @PrimaryGeneratedColumn()
  testcase_id: number;

  @Column('bigint')
  problem_id: string;

  @Column()
  input_tc: string; // S3 Key for input file

  @Column()
  output_tc: string; // S3 Key for output file

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // 관계 설정
  @ManyToOne(() => Problem)
  @JoinColumn({ name: 'problem_id' })
  problem: Problem;
}
