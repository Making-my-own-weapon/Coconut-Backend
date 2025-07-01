import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Problem } from './entities/problem.entity';
import { RoomProblem } from './entities/room-problem.entity';
import { CreateDbProblemDto } from './dtos/create-db-problem.dto';
import { AssignRoomProblemDto } from './dtos/assign-room-problem.dto';
import { UpdateProblemDto } from './dtos/update-problem.dto';
import { ProblemSummaryDto } from './dtos/problem-summary.dto';

@Injectable()
export class ProblemsService {
  constructor(
    @InjectRepository(Problem)
    private readonly problemRepo: Repository<Problem>,

    @InjectRepository(RoomProblem)
    private readonly roomProblemRepo: Repository<RoomProblem>,
  ) {}

  /** 1) DB에 새 문제 생성 */
  async createProblem(dto: CreateDbProblemDto): Promise<Problem> {
    const problem = this.problemRepo.create({
      title: dto.title,
      executionTimeLimitMs: dto.timeLimitMs,
      memoryLimitKb: dto.memoryLimitKb,
      description: dto.description,
      solveTimeLimitMin: dto.solveTimeLimitMin,
      source: dto.source,
      categories: dto.categories,
      testcases: dto.testCases.map((tc) => ({
        inputTc: tc.input,
        outputTc: tc.output,
      })),
    });
    return this.problemRepo.save(problem);
  }

  /** 2) 방에 문제 할당 */
  async assignProblemToRoom(
    roomId: number,
    dto: AssignRoomProblemDto,
  ): Promise<RoomProblem> {
    // TODO: 권한 체크, 방 존재 여부 검증 등
    const link = this.roomProblemRepo.create({
      roomId,
      problemId: dto.problemId,
    });
    return this.roomProblemRepo.save(link);
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
    return raws.map((p) => {
      const dto = new ProblemSummaryDto();
      dto.problemId = p.problemId;
      dto.title = p.title;
      dto.source = p.source;
      dto.categories = p.categories;
      return dto;
    });
  }

  /** 5) 방별 문제 목록 조회 (RoomProblem ↔ Problem join) */
  async getProblemsByRoomId(roomId: number): Promise<Problem[]> {
    const links = await this.roomProblemRepo.find({
      where: { roomId },
      relations: ['problem'],
    });
    return links.map((link) => link.problem);
  }

  /** 6) 방별 특정 문제 상세 조회 */
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

  /** 7) 방별 문제 정보 일부 수정 */
  async updateProblemDetailByRoomId(
    roomId: number,
    pid: number,
    dto: UpdateProblemDto,
  ): Promise<Problem> {
    // TODO: 권한 체크, 방 존재 여부 검증 등
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
    return this.problemRepo.save(problem);
  }
}
