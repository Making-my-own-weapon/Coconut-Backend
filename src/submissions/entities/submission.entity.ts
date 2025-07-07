// src/rooms/entities/room.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Room } from '../../rooms/entities/room.entity';
import { Problem } from '../../problems/entities/problem.entity';

@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn()
  submission_id: number;

  @Column()
  user_id: number;

  @Column()
  room_id: number;

  @Column('bigint')
  problem_id: string; // BIGINT는 string으로 처리

  @Column('text')
  code: string;

  @Column({ default: 'python' })
  language: string;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'RUNNING', 'SUCCESS', 'FAIL'],
    default: 'PENDING',
  })
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAIL';

  @Column({ default: false })
  is_passed: boolean;

  @Column({ default: 0 })
  passed_tc_count: number;

  @Column({ default: 0 })
  total_tc_count: number;

  @Column({ default: 0 })
  execution_time_ms: number;

  @Column({ default: 0 })
  memory_usage_kb: number;

  @Column({ nullable: true })
  stdout: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // 관계 설정
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Room)
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @ManyToOne(() => Problem)
  @JoinColumn({ name: 'problem_id' })
  problem: Problem;
}
