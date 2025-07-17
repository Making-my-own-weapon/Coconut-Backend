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
import { EditorGateway } from '../editor/editor.gateway';

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
    private readonly editorGateway: EditorGateway,
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
    // 방 생성자(선생님)의 roomId 갱신
    await this.usersService.updateUserRoomId(creatorId, saved.roomId);
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
      // 참가자의 roomId 갱신
      await this.usersService.updateUserRoomId(userId, room.roomId);
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
    endTime?: string,
  ): Promise<boolean> {
    const room = await this.roomRepo.findOne({ where: { roomId } });
    if (!room || room.creatorId !== requesterId) {
      return false;
    }
    room.status = newStatus;

    // 수업 종료 시 endTime 저장 (프론트엔드에서 전달받은 타이머 값 사용)
    if (newStatus === RoomStatus.FINISHED && endTime) {
      room.endTime = endTime;
    }

    await this.roomRepo.save(room);

    if (newStatus === RoomStatus.FINISHED) {
      console.log(`[Backend] Emitting class:ended for room ${roomId}`);
      const roomName = `room_${room.inviteCode}`;
      this.editorGateway.server.to(roomName).emit('class:ended', { roomId });
      // 방 생성자(선생님)의 roomId null로 갱신
      await this.usersService.updateUserRoomId(requesterId, null);
    }
    return true;
  }

  async deleteRoom(roomId: number, requesterId: number): Promise<void> {
    const room = await this.roomRepo.findOne({ where: { roomId } });

    // 방이 없거나, 요청자가 방 생성자가 아니면 에러 발생
    if (!room || room.creatorId !== requesterId) {
      throw new ForbiddenException('방을 삭제할 권한이 없습니다.');
    }

    await this.roomRepo.remove(room);
    // 방 생성자(선생님)의 roomId null로 갱신
    await this.usersService.updateUserRoomId(requesterId, null);
  }

  // 여기는 리포트 페이지 관련 로직들 모아둔 곳입니다~『안채호』1
  async getRoomReport(roomId: number) {
    // 1. 방 정보 조회 (수업명, 참가자 수)
    const room = await this.roomRepo.findOne({ where: { roomId } });
    if (!room) {
      throw new BadRequestException('방을 찾을 수 없습니다.');
    }

    // 2. 제출 기록 조회 (relations을 통해 user와 problem 정보도 함께 조회)
    const submissions = await this.submissionRepo.find({
      where: { room_id: roomId },
      relations: ['user', 'problem'],
    });

    // 3. 방에 할당된 문제들 조회
    const roomProblems = await this.rpRepo.find({
      where: { roomId },
      relations: ['problem'],
    });
    const problems = roomProblems.map((rp) => rp.problem);

    // 4. 기본 통계 계산
    const totalSubmissions = submissions.length;
    const passedSubmissions = submissions.filter((s) => s.is_passed);
    const averageSuccessRate =
      totalSubmissions > 0
        ? Math.round((passedSubmissions.length / totalSubmissions) * 100)
        : 0;

    // 5. 평균 풀이 시간 (고정값)
    const averageSolveTime = '0:00';

    // 6. 문제별 정답률 계산
    const problemAnalysis = problems.map((problem) => {
      const problemSubmissions = submissions.filter(
        (s) => Number(s.problem_id) === problem.problemId,
      );
      const problemPassed = problemSubmissions.filter((s) => s.is_passed);
      const successRate =
        problemSubmissions.length > 0
          ? Math.round((problemPassed.length / problemSubmissions.length) * 100)
          : 0;
      return {
        title: problem.title,
        successRate,
      };
    });

    // 7. 가장 어려운/쉬운 문제 찾기
    const problemsWithRates = problemAnalysis.filter((p) => p.successRate >= 0);
    const hardestProblem =
      problemsWithRates.length > 0
        ? problemsWithRates.reduce((min, p) =>
            p.successRate < min.successRate ? p : min,
          )
        : { title: 'N/A', successRate: 0 };
    const easiestProblem =
      problemsWithRates.length > 0
        ? problemsWithRates.reduce((max, p) =>
            p.successRate > max.successRate ? p : max,
          )
        : { title: 'N/A', successRate: 0 };

    // 8. 학생별 정답률 계산
    const studentSubmissions: { name: string; successRate: number }[] = [];
    const students =
      room.participants?.filter((p) => p.userType === 'student') || [];

    for (const student of students) {
      const studentSubs = submissions.filter(
        (s) => s.user_id === student.userId,
      );
      const studentPassed = studentSubs.filter((s) => s.is_passed);
      const successRate =
        studentSubs.length > 0
          ? Math.round((studentPassed.length / studentSubs.length) * 100)
          : 0;

      studentSubmissions.push({
        name: student.name,
        successRate,
      });
    }

    // 9. 수업 시간 (타이머에서 저장된 시간 사용)
    const classTime = room.endTime || '00:00:00';

    return {
      roomTitle: room.title,
      averageSuccessRate,
      averageSolveTime,
      totalSubmissions,
      totalProblems: problems.length,
      totalStudents: students.length,
      hardestProblem: {
        name: hardestProblem.title || 'N/A',
        rate: hardestProblem.successRate,
      },
      easiestProblem: {
        name: easiestProblem.title || 'N/A',
        rate: easiestProblem.successRate,
      },
      problemAnalysis,
      studentSubmissions,
      submissions: submissions.map((sub) => ({
        submission_id: sub.submission_id,
        user_id: sub.user_id,
        problem_id: sub.problem_id,
        code: sub.code,
        status: sub.status,
        is_passed: sub.is_passed,
        passed_tc_count: sub.passed_tc_count,
        total_tc_count: sub.total_tc_count,
        execution_time_ms: sub.execution_time_ms,
        memory_usage_kb: sub.memory_usage_kb,
        created_at: sub.created_at,
        user: sub.user,
        problem: sub.problem,
      })), // 제출 데이터 추가
      classTime,
      classStatus: room.status,
    };
  }
}
