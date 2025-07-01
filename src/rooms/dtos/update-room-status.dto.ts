// src/rooms/dtos/update-room-status.dto.ts
import { IsEnum } from 'class-validator';

export enum RoomStatus {
  WAITING = 'WAITING',
  IN_PROGRESS = 'IN_PROGRESS',
  FINISHED = 'FINISHED',
}

export class UpdateRoomStatusDto {
  @IsEnum(RoomStatus)
  status: RoomStatus;
}
