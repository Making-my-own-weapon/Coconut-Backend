// src/rooms/dtos/update-room-status.dto.ts
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';

export enum RoomStatus {
  WAITING = 'WAITING',
  IN_PROGRESS = 'IN_PROGRESS',
  FINISHED = 'FINISHED',
}

export class UpdateRoomStatusDto {
  @IsEnum(RoomStatus)
  status: RoomStatus;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}:\d{2}$/, {
    message: 'endTime must be in HH:MM:SS format',
  })
  endTime?: string;
}
