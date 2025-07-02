import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room, RoomStatus } from './entities/room.entity';
import { CreateRoomDto } from './dtos/create-room.dto';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
  ) {}

  private generateInviteCode(): string {
    return Math.random().toString(36).slice(2, 10);
  }

  async createRoom(
    createRoomDto: CreateRoomDto,
    creatorId: number,
  ): Promise<{ roomId: number; inviteCode: string }> {
    // 중복 체크
    const existingRoom = await this.roomRepository.findOne({
      where: { creatorId },
    });
    if (existingRoom) {
      throw new BadRequestException('이미 생성한 방이 있습니다.');
    }

    const inviteCode = this.generateInviteCode();

    const room = this.roomRepository.create({
      title: createRoomDto.title,
      description: createRoomDto.description,
      maxParticipants: createRoomDto.maxParticipants, // ← 명시적 매핑
      inviteCode,
      status: RoomStatus.WAITING,
      creatorId,
      participants: [],
      problems: [],
    });

    const savedRoom = await this.roomRepository.save(room);
    console.log('방 생성됨:', savedRoom);
    return { roomId: savedRoom.roomId, inviteCode };
  }

  // 초대코드로 방 참여
  async joinRoom(inviteCode: string, userId: number) {
    console.log('joinRoom 호출됨:', { inviteCode, userId });

    const room = await this.roomRepository.findOne({ where: { inviteCode } });
    console.log('찾은 방:', room);

    if (!room) {
      throw new BadRequestException('유효하지 않은 초대코드입니다.');
    }

    if (!room.participants) {
      room.participants = [];
      console.log('participants 초기화됨');
    }

    const alreadyJoined = room.participants.some((p) => p.userId === userId);
    console.log('이미 참여 중인지:', alreadyJoined);

    if (!alreadyJoined) {
      room.participants.push({ userId, name: `사용자${userId}` });
      console.log('참가자 추가됨:', room.participants);
      await this.roomRepository.save(room);
      console.log('방 저장 완료');
    }

    return {
      roomId: room.roomId,
      title: room.title,
      status: room.status,
      participants: room.participants,
    };
  }

  // 방 정보 조회
  async getRoomInfo(roomId: number, requesterId: number) {
    const room = await this.roomRepository.findOne({ where: { roomId } });
    if (!room || room.creatorId !== requesterId) {
      return null;
    }

    return {
      roomId: room.roomId,
      title: room.title,
      status: room.status,
      participants: room.participants || [],
      problems: room.problems || [],
    };
  }

  // 방 상태 변경 (시작 / 종료)
  async updateRoomStatus(
    roomId: number,
    requesterId: number,
    newStatus: RoomStatus,
  ): Promise<boolean> {
    const room = await this.roomRepository.findOne({ where: { roomId } });
    if (!room || room.creatorId !== requesterId) {
      return false;
    }

    room.status = newStatus;
    await this.roomRepository.save(room);
    return true;
  }
}
