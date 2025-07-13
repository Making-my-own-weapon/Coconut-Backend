// src/rooms/rooms.service.ts
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room, RoomStatus } from './entities/room.entity';
import { RoomProblem } from '../problems/entities/room-problem.entity';
import { Problem } from '../problems/entities/problem.entity';
import { CreateRoomDto } from './dtos/create-room.dto';
import { UsersService } from '../users/users.service';
import { Submission } from '../submissions/entities/submission.entity';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    @InjectRepository(RoomProblem)
    private readonly rpRepo: Repository<RoomProblem>,
    @InjectRepository(Problem)
    private readonly problemRepo: Repository<Problem>,
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    private readonly usersService: UsersService,
  ) {}

  private generateInviteCode(): string {
    return Math.random().toString(36).slice(2, 10);
  }

  /** 1) 방 생성 */
  async createRoom(
    dto: CreateRoomDto,
    creatorId: number,
  ): Promise<{ roomId: number; inviteCode: string }> {
    const existing = await this.roomRepo.findOne({ where: { creatorId } });
    if (existing) {
      throw new BadRequestException('이미 생성한 방이 있습니다.');
    }

    // 선생님 정보 가져오기
    const teacher = await this.usersService.findOneById(creatorId);
    if (!teacher) {
      throw new BadRequestException('사용자 정보를 찾을 수 없습니다.');
    }

    const inviteCode = this.generateInviteCode();
    const room = this.roomRepo.create({
      title: dto.title,
      description: dto.description,
      maxParticipants: dto.maxParticipants + 1, // 학생 수 + 선생님 1명
      inviteCode,
      status: RoomStatus.WAITING,
      creatorId,
      participants: [
        { userId: creatorId, name: teacher.name, userType: 'teacher' },
      ],
    });
    const saved = await this.roomRepo.save(room);
    return { roomId: saved.roomId, inviteCode };
  }

  /** 2) 초대코드로 방 참가 */
  async joinRoom(inviteCode: string, userId: number, userName: string) {
    const room = await this.roomRepo.findOne({ where: { inviteCode } });
    if (!room) {
      throw new BadRequestException('유효하지 않은 초대코드입니다.');
    }

    if (room.creatorId === userId) {
      throw new BadRequestException(
        '자신이 생성한 수업에는 참여할 수 없습니다.',
      );
    }

    if (room.participants.length >= room.maxParticipants) {
      throw new BadRequestException('수업 정원이 가득 찼습니다.');
    }

    room.participants = room.participants || [];
    if (!room.participants.some((p) => p.userId === userId)) {
      room.participants.push({ userId, name: userName, userType: 'student' });
      await this.roomRepo.save(room);
    }

    return {
      roomId: room.roomId,
      title: room.title,
      status: room.status,
      participants: room.participants,
    };
  }

  /** 3) 방 상세 조회 — 조인 테이블에서 문제를 가져오도록 변경 */
  async getRoomInfo(roomId: number, requesterId: number) {
    const room = await this.roomRepo.findOne({ where: { roomId } });
    if (!room) return null;

    // 방 생성자도 아니고, 참여자도 아니면 접근을 거부합니다.
    const isParticipant = room.participants?.some(
      (p) => p.userId === requesterId,
    );
    if (room.creatorId !== requesterId && !isParticipant) {
      return null;
    }

    // 조인 테이블에서 연결된 Problem 엔티티를 직접 조회
    const links = await this.rpRepo.find({
      where: { roomId },
      relations: ['problem', 'problem.testcases'],
    });
    const problems = links.map((link) => {
      const allTcs = link.problem.testcases.map((tc) => ({
        id: tc.id,
        input: tc.inputTc,
        output: tc.outputTc,
      }));
      return {
        ...link.problem,
        // 테스트케이스는 최대 3개까지만 잘라서 넘겨줍니다
        testCases: allTcs.slice(0, 3),
      };
    });

    return {
      roomId: room.roomId,
      title: room.title,
      inviteCode: room.inviteCode,
      status: room.status,
      participants: room.participants || [],
      problems, // 여기로 할당된 문제 리스트를 보내줍니다
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }

  /** 4) 방 상태 변경 */
  async updateRoomStatus(
    roomId: number,
    requesterId: number,
    newStatus: RoomStatus,
  ): Promise<boolean> {
    const room = await this.roomRepo.findOne({ where: { roomId } });
    if (!room || room.creatorId !== requesterId) {
      return false;
    }
    room.status = newStatus;
    await this.roomRepo.save(room);
    return true;
  }

  async deleteRoom(roomId: number, requesterId: number): Promise<void> {
    const room = await this.roomRepo.findOne({ where: { roomId } });

    // 방이 없거나, 요청자가 방 생성자가 아니면 에러 발생
    if (!room || room.creatorId !== requesterId) {
      throw new ForbiddenException('방을 삭제할 권한이 없습니다.');
    }

    await this.roomRepo.remove(room);
  }

  // 여기는 리포트 페이지 관련 로직들 모아둔 곳입니다~『안채호』1
  async getRoomReport(roomId: number) {
    const submissions = await this.submissionRepo.find({
      where: { room_id: roomId },
    }); //평균 정답률 1

    if (submissions.length === 0) {
      return { averageSuccessRate: 0 };
    } //평균 정답률 2

    const correctSubmissions = submissions.filter((s) => s.is_passed).length;
    const averageSuccessRate = Math.round(
      (correctSubmissions / submissions.length) * 100,
    ); //평균 정답률 3

    return { averageSuccessRate }; //평균 정답률 4
  }
}
