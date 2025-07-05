// src/rooms/rooms.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { RoomsService } from './rooms.service';

// DTO import
import { CreateRoomDto } from './dtos/create-room.dto';
import { JoinRoomDto } from './dtos/join-room.dto';
import { UpdateRoomStatusDto } from './dtos/update-room-status.dto';

// req.user 타입 정의 (필요하다면 별도 파일로 뽑아도 좋습니다)
interface RequestWithUser extends Request {
  user: {
    id: number;
    email: string;
    // ... 그 외 페이로드 필드
  };
}

@Controller('api/v1/rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  /** 수업(방) 생성 */
  @Post('create')
  create(@Body() createRoomDto: CreateRoomDto, @Req() req: RequestWithUser) {
    const creatorId = req.user.id;
    return this.roomsService.createRoom(createRoomDto, creatorId);
  }

  /** 초대 코드로 수업 참가 */
  @Post('join')
  joinRoom(@Body() joinRoomDto: JoinRoomDto, @Req() req: RequestWithUser) {
    const userId = req.user.id;
    return this.roomsService.joinRoom(joinRoomDto.inviteCode, userId);
  }

  /**
   * 방 정보 + 할당된 문제들 조회 (호스트만 접근 가능)
   */
  @Get(':roomId')
  async getRoomInfo(
    @Param('roomId') roomId: string,
    @Req() req: RequestWithUser,
  ) {
    const id = Number(roomId);
    const userId = req.user.id;
    const roomInfo = await this.roomsService.getRoomInfo(id, userId);
    if (!roomInfo) {
      throw new ForbiddenException('방 생성자만 접근할 수 있습니다.');
    }
    return roomInfo;
  }

  /** 방 상태 변경 (호스트만) */
  @Patch(':roomId')
  async updateRoomStatus(
    @Param('roomId') roomId: string,
    @Body() updateDto: UpdateRoomStatusDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.id;
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
