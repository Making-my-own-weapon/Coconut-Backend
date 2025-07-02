// src/rooms/rooms.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';

// DTO import
import { CreateRoomDto } from './dtos/create-room.dto';
import { JoinRoomDto } from './dtos/join-room.dto';
import { UpdateRoomStatusDto } from './dtos/update-room-status.dto';

@Controller('api/v1/rooms')
export class RoomsController {
  // 의존성 주입  RoomsSevrice를 주입받고 roomsService라는 이름으로 사용할 것
  // 클래스 외부에서 접근 불가 내부에서만 쓸 것
  constructor(private readonly roomsService: RoomsService) {}

  @Post('create')
  create(
    @Body() createRoomDto: CreateRoomDto,
    @Headers('user-id') userIdHeader: string,
  ) {
    // console.log('=== Controller에서 받은 데이터 ===');
    // console.log('createRoomDto:', createRoomDto);
    // console.log('createRoomDto type:', typeof createRoomDto);
    // console.log('createRoomDto keys:', Object.keys(createRoomDto));
    // console.log('createRoomDto stringified:', JSON.stringify(createRoomDto));
    // console.log('userIdHeader:', userIdHeader);
    const creatorId = Number(userIdHeader);
    return this.roomsService.createRoom(createRoomDto, creatorId);
  }

  @Post('join')
  joinRoom(
    @Body() joinRoomDto: JoinRoomDto,
    @Headers('user-id') userIdHeader: string,
  ) {
    const userId = Number(userIdHeader);
    return this.roomsService.joinRoom(joinRoomDto.inviteCode, userId);
  }

  @Get(':roomId')
  async getRoomInfo(
    @Param('roomId') roomId: string,
    @Headers('user-id') userIdHeader: string,
  ) {
    const id = Number(roomId);
    const userId = Number(userIdHeader);
    const roomInfo = await this.roomsService.getRoomInfo(id, userId);
    if (!roomInfo) {
      throw new ForbiddenException('방 생성자만 접근할 수 있습니다.');
    }
    return roomInfo;
  }

  @Patch(':roomId')
  async updateRoomStatus(
    @Param('roomId') roomId: string,
    @Body() updateDto: UpdateRoomStatusDto,
    @Headers('user-id') userIdHeader: string,
  ) {
    const userId = Number(userIdHeader);
    const success = await this.roomsService.updateRoomStatus(
      Number(roomId),
      userId,
      updateDto.status,
    );
    if (!success) {
      throw new ForbiddenException('방 생성자만 상태를 변경할 수 있습니다.');
    }
    return { success: true };
  }
}
