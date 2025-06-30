// src/rooms/entities/room.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Problem } from '../../problems/entities/problem.entity';

@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn() id: number;
  @Column({ nullable: true }) dummy: string;
  @ManyToOne(() => Problem, (problem) => problem.submissions)
  @JoinColumn({ name: 'problem_id' })
  problem: Problem;
}
