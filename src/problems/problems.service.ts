import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../rooms/entities/room.entity';
import { Problem } from './entities/problem.entity';
import { RoomProblem } from './entities/room-problem.entity';
import { Testcase } from './entities/testcase.entity';
import { CreateDbProblemDto } from './dtos/create-db-problem.dto';
import { UpdateProblemDto } from './dtos/update-problem.dto';
import { ProblemSummaryDto } from './dtos/problem-summary.dto';
import { EditorGateway } from '../editor/editor.gateway';
import { S3Service } from '../common/s3.service';

@Injectable()
export class ProblemsService {
  constructor(
    @InjectRepository(Problem)
    private readonly problemRepo: Repository<Problem>,

    @InjectRepository(RoomProblem)
    private readonly roomProblemRepo: Repository<RoomProblem>,

    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>, // 방 정보 조회용
    private readonly editorGateway: EditorGateway, // ← 추가
    private readonly s3Service: S3Service, // S3 서비스 주입
  ) {}

  /** 1) DB에 새 문제 생성 (S3 업로드 포함) */
  async createProblem(
    dto: CreateDbProblemDto,
    creatorId?: number,
  ): Promise<Problem> {
    // 1. 문제 먼저 생성 (testcases는 나중에 추가)
    const problem = this.problemRepo.create({
      title: dto.title,
      executionTimeLimitMs: dto.timeLimitMs,
      memoryLimitKb: dto.memoryLimitKb,
      description: dto.description,
      solveTimeLimitMin: dto.solveTimeLimitMin,
      source: dto.source,
      categories: dto.categories,
      creator: { id: creatorId },
      // 1번 테스트케이스를 example_tc에 저장
      exampleTc:
        dto.testCases.length > 0
          ? JSON.stringify({
              input: dto.testCases[0].inputTc,
              output: dto.testCases[0].outputTc,
            })
          : undefined,
    });

    const savedProblem = await this.problemRepo.save(problem);

    // 2. 모든 테스트케이스를 S3에 업로드하고 DB에 저장
    for (let i = 0; i < dto.testCases.length; i++) {
      const tc = dto.testCases[i];
      const folderName = `problems/${savedProblem.problemId}`;

      // S3 키 생성
      const inputKey = `${folderName}/input_${i + 1}.txt`;
      const outputKey = `${folderName}/output_${i + 1}.txt`;

      try {
        // S3에 업로드
        await this.s3Service.uploadFile(tc.inputTc, inputKey);
        await this.s3Service.uploadFile(tc.outputTc, outputKey);

        // testcases 테이블에 S3 키 저장 (TypeORM 관계 사용)
        const testcase = this.problemRepo.manager
          .getRepository(Testcase)
          .create({
            problem: savedProblem, // 관계를 통한 연결
            inputTc: inputKey,
            outputTc: outputKey,
          });
        await this.problemRepo.manager.getRepository(Testcase).save(testcase);
      } catch (error) {
        // S3 업로드 실패 시 문제 삭제
        await this.problemRepo.delete(savedProblem.problemId);
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`테스트케이스 업로드 실패: ${errorMessage}`);
      }
    }

    return savedProblem;
  }

  /** 2) 방에 문제 할당 (호스트만)*/
  async assignProblemToRoom(
    roomId: number,
    problemIds: number[],
    userId: number,
  ): Promise<RoomProblem[]> {
    // 1) 방 존재 및 호스트 여부 확인
    const room = await this.roomRepo.findOneBy({ roomId });
    if (!room) throw new NotFoundException('Room not found');
    if (room.creatorId !== userId)
      throw new ForbiddenException('방 생성자만 문제를 할당할 수 있습니다.');
    console.log('[AssignRoom]', { roomId, problemIds, userId });

    // 2) 문제-방 링크 생성(매핑 후 여러번 링크)
    const links = problemIds.map((problemId) =>
      this.roomProblemRepo.create({ roomId, problemId }),
    );
    const result = await this.roomProblemRepo.save(links);
    // 문제 할당 후 소켓 이벤트 emit
    if (room.inviteCode) {
      this.editorGateway.server
        .to(`room_${room.inviteCode}`)
        .emit('problem:updated', { roomId: room.roomId });
    }
    return result;
  }

  /** 3) DB의 모든 문제 목록 조회 */
  async getAllProblems(): Promise<Problem[]> {
    return this.problemRepo.find({
      select: ['problemId', 'title', 'executionTimeLimitMs', 'memoryLimitKb'],
    });
  }

  /** 4) 문제 정보 요약본 가져오기 */
  async getProblemSummaries(): Promise<ProblemSummaryDto[]> {
    const raws = await this.problemRepo.find({
      select: ['problemId', 'title', 'source', 'categories'],
    });

    // 엔티티 배열을 DTO 배열로 변환 (여기선 필드명이 같아 바로 반환해도 무방합니다)
    return raws.map((p) => Object.assign(new ProblemSummaryDto(), p));
  }

  /** 5) 특정 문제 상세 정보 조회 (방 할당 여부와 관계없이) */
  async getProblemDetail(problemId: number): Promise<Problem> {
    const problem = await this.problemRepo.findOne({
      where: { problemId },
      relations: ['testcases'],
    });
    if (!problem) throw new NotFoundException('Problem not found');
    return problem;
  }

  /** 6) 방별 문제 목록 조회 (RoomProblem ↔ Problem join) */
  async getProblemsByRoomId(roomId: number): Promise<Problem[]> {
    const links = await this.roomProblemRepo.find({
      where: { roomId },
      relations: ['problem'],
    });
    return links.map((link) => link.problem);
  }

  /** 7) 방별 특정 문제 상세 조회 */
  async getProblemDetailByRoomId(
    roomId: number,
    pid: number,
  ): Promise<Problem> {
    const link = await this.roomProblemRepo.findOne({
      where: { roomId, problemId: pid },
      relations: ['problem', 'problem.testcases'],
    });
    if (!link) throw new NotFoundException('Problem not found in this room');
    return link.problem;
  }

  /** 8) 방별 문제 정보 일부 수정 (호스트만)*/
  async updateProblemDetailByRoomId(
    roomId: number,
    pid: number,
    dto: UpdateProblemDto,
    userId: number,
  ): Promise<Problem> {
    // 1) 방 존재 및 호스트 여부 확인
    const room = await this.roomRepo.findOneBy({ roomId });
    if (!room) throw new NotFoundException('Room not found');
    if (room.creatorId !== userId)
      throw new ForbiddenException('방 생성자만 수정할 수 있습니다.');

    // 2) 문제 조회·업데이트
    const problem = await this.problemRepo.findOne({
      where: { problemId: pid },
    });
    if (!problem) throw new NotFoundException('Problem not found');
    Object.assign(problem, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.timeLimitMs !== undefined && {
        executionTimeLimitMs: dto.timeLimitMs,
      }),
      ...(dto.memoryLimitKb !== undefined && {
        memoryLimitKb: dto.memoryLimitKb,
      }),
      ...(dto.sampleTestcases !== undefined && {
        sampleTestcases: dto.sampleTestcases,
      }),
    });
    const updated = await this.problemRepo.save(problem);
    // 문제 수정 후 소켓 이벤트 emit
    if (room.inviteCode) {
      this.editorGateway.server
        .to(`room_${room.inviteCode}`)
        .emit('problem:updated', { roomId: room.roomId });
    }
    return updated;
  }

  /** 9) 방에서 문제 제거 (호스트만) - DB 문제는 삭제하지 않고 방-문제 연결만 제거 */
  async removeProblemFromRoom(
    roomId: number,
    problemId: number,
    userId: number,
  ): Promise<void> {
    // 1) 방 존재 및 호스트 여부 확인
    const room = await this.roomRepo.findOneBy({ roomId });
    if (!room) throw new NotFoundException('Room not found');
    if (room.creatorId !== userId)
      throw new ForbiddenException('방 생성자만 문제를 제거할 수 있습니다.');

    // 2) 방-문제 링크만 삭제 (Problem 테이블은 건드리지 않음)
    const result = await this.roomProblemRepo.delete({
      roomId,
      problemId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Problem not found in this room');
    }
    // 문제 삭제 후 소켓 이벤트 emit
    if (room.inviteCode) {
      this.editorGateway.server
        .to(`room_${room.inviteCode}`)
        .emit('problem:updated', { roomId: room.roomId });
    }
  }

  /** 내가 만든 문제 목록 조회 */
  async getMyProblems(creatorId: number): Promise<Problem[]> {
    return this.problemRepo.find({ where: { creator: { id: creatorId } } });
  }

  /** DB에서 문제 영구 삭제 (생성자만) */
  async deleteProblem(problemId: number, userId: number): Promise<void> {
    // findOneBy 대신 findOne과 relations를 사용합니다.
    const problem = await this.problemRepo.findOne({
      where: { problemId },
      relations: ['creator'],
    });

    if (!problem) throw new NotFoundException('Problem not found');

    // problem.creator.id로 접근합니다.
    if (problem.creator.id !== userId)
      throw new ForbiddenException('문제를 삭제할 권한이 없습니다.');

    await this.problemRepo.remove(problem);
  }
}
