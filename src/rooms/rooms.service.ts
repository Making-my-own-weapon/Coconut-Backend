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
    console.log('--- Service: joinRoom 호출됨 ---');
    console.log(`서비스가 받은 초대 코드: ${inviteCode}`);

    const room = await this.roomRepository.findOne({ where: { inviteCode } });
    console.log('DB에서 찾은 방:', room);

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

  async getRoomInfo(roomId: number, requesterId: number) {
    const room = await this.roomRepository.findOne({ where: { roomId } });
    if (!room) {
      return null;
    }

    // 요청자가 참여자 목록에 있는지 확인
    const isParticipant = room.participants.some(
      (p) => p.userId === requesterId,
    );

    // 방 생성자도 아니고, 참여자도 아니면 접근을 거부합니다.
    if (room.creatorId !== requesterId && !isParticipant) {
      return null;
    }

    // 권한이 있으면 방 정보를 반환합니다.
    return {
      roomId: room.roomId,
      title: room.title,
      inviteCode: room.inviteCode,
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
