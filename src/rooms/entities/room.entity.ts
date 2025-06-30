// src/rooms/entities/room.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { RoomProblem } from '../../problems/entities/room-problem.entity';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn() id: number;
  @Column({ nullable: true }) dummy: string;
  @OneToMany(() => RoomProblem, (rp) => rp.room)
  problems: RoomProblem[];
}
