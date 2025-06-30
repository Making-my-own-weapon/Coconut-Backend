import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Room } from '../../rooms/entities/room.entity';
import { Problem } from './problem.entity';

@Entity('room_problems')
export class RoomProblem {
  @PrimaryColumn({ name: 'room_id' })
  roomId: number; // FK to rooms.id

  @PrimaryColumn({ name: 'problem_id' })
  problemId: number; // FK to problems.problemId

  @ManyToOne(() => Room, (room) => room.problems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @ManyToOne(() => Problem, (problem) => problem.roomLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'problem_id' })
  problem: Problem;
}
