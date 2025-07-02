import { Problem } from '../../problems/entities/problem.entity';
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

@Entity('users')
export class User {

  @PrimaryGeneratedColumn({ name: 'user_id' }) // DB 컬럼명은 'user_id'
  id: number; // 코드 내에서는 'id'로 사용

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({
    name: 'refresh_token',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  refreshToken: string | null;

  @CreateDateColumn({ name: 'created_at' }) // DB 컬럼명은 'created_at'
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' }) // DB 컬럼명은 'updated_at'
  updatedAt: Date;

  // Problem 엔티티와의 관계 (스키마의 fk_problems_creator에 해당)

  @OneToMany(() => Problem, (problem) => problem.creator)
  createdProblems: Problem[];

  // room_id 관련 코드는 Room 엔티티를 만든 후에 추가하겠습니다.
}
