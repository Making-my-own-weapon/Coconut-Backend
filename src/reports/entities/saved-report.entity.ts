import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('saved_reports')
export class SavedReport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column()
  room_title: string;

  @Column('json')
  report_data: any; // 리포트 전체 데이터를 JSON으로 저장

  @Column({ default: 'student' })
  report_type: 'teacher' | 'student'; // 리포트 타입 (선생님/학생)

  @CreateDateColumn()
  saved_at: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
