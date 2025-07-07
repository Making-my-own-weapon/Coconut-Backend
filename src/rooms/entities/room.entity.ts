import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum RoomStatus {
  WAITING = 'WAITING',
  IN_PROGRESS = 'IN_PROGRESS',
  FINISHED = 'FINISHED',
}

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn({ name: 'room_id' })
  roomId: number;

  @Column()
  title: string;

  @Column('text') // TEXT 타입 명시
  description: string;

  @Column({ name: 'max_participants' })
  maxParticipants: number;

  @Column({ name: 'invite_code', unique: true })
  inviteCode: string;

  @Column({
    type: 'enum',
    enum: RoomStatus,
    default: RoomStatus.WAITING,
  })
  status: RoomStatus;

  @Column({ name: 'creator_id' })
  creatorId: number;

  @Column('simple-json', { nullable: true })
  participants: {
    userId: number;
    name: string;
    userType: 'teacher' | 'student';
  }[];

  @Column('simple-json', { nullable: true })
  problems: any[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
