import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Problem } from './entities/problem.entity';
import { RoomProblem } from './entities/room-problem.entity';
import { CreateDbProblemDto } from './dtos/create-db-problem.dto';
import { AssignRoomProblemDto } from './dtos/assign-room-problem.dto';
import { UpdateProblemDto } from './dtos/update-problem.dto';

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
      // solveTimeLimitMin: dto.solveTimeLimitMin, // 필요하면 DTO에 추가
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

  /** 4) 방별 문제 목록 조회 (RoomProblem ↔ Problem join) */
  async getProblemsByRoomId(roomId: number): Promise<Problem[]> {
    const links = await this.roomProblemRepo.find({
      where: { roomId },
      relations: ['problem'],
    });
    return links.map((link) => link.problem);
  }

  /** 5) 방별 특정 문제 상세 조회 */
  async getProblemDetailByRoodId(
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

  /** 6) 방별 문제 정보 일부 수정 */
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
