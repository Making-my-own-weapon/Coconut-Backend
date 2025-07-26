// src/backend/problems/problems.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ProblemsService } from './problems.service';
import { CreateDbProblemDto } from './dtos/create-db-problem.dto';
import { AssignRoomProblemDto } from './dtos/assign-room-problem.dto';
import { UpdateProblemDto } from './dtos/update-problem.dto';
import { ProblemSummaryDto } from './dtos/problem-summary.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface RequestWithUser extends Request {
  user: { id: number };
}

@Controller('api/v1')
export class ProblemsController {
  constructor(private readonly svc: ProblemsService) {}

  /** 1) DB에 새 문제 생성 */
  @Post('db/problems')
  @UseGuards(JwtAuthGuard) // 👈 1. 로그인이 필요한 기능이므로 가드 추가
  createProblem(@Body() dto: CreateDbProblemDto, @Req() req: RequestWithUser) {
    const creatorId = req.user.id; // 👈 2. 요청에서 사용자 ID 추출
    return this.svc.createProblem(dto, creatorId); // 👈 3. 서비스에 전달
  } //내가 바꿨다. 『안채호』

  /** 2) 방에 문제 할당 (호스트만) */
  @Post('rooms/:roomId/problems')
  assignProblemToRoom(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body() dto: AssignRoomProblemDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.id;
    return this.svc.assignProblemToRoom(roomId, dto.problemIds, userId);
  }

  /** 3) DB의 모든 문제 목록 조회 */
  @Get('db/problems')
  getAllProblems() {
    return this.svc.getAllProblems();
  }

  /** 4) 문제 정보 요약본 가져오기 */
  @Get('db/problems/summary')
  getProblemSummaries(): Promise<ProblemSummaryDto[]> {
    return this.svc.getProblemSummaries();
  }

  /** 10) 내가 만든 문제 목록 조회 */
  @Get('db/problems/my')
  @UseGuards(JwtAuthGuard)
  getMyProblems(@Req() req: RequestWithUser) {
    const userId = req.user.id;
    return this.svc.getMyProblems(userId);
  }

  /** 5) 특정 문제 상세 정보 조회 (방 할당 여부와 관계없이) */
  @Get('db/problems/:problemId')
  getProblemDetail(@Param('problemId', ParseIntPipe) problemId: number) {
    return this.svc.getProblemDetail(problemId);
  }

  /** 6) 방별 문제 목록 조회 */
  @Get('rooms/:roomId/problems')
  getProblemsByRoomId(@Param('roomId', ParseIntPipe) roomId: number) {
    return this.svc.getProblemsByRoomId(roomId);
  }

  /** 7) 방별 특정 문제 상세 조회 */
  @Get('rooms/:roomId/problems/:pid')
  getProblemDetailByRoomId(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Param('pid', ParseIntPipe) pid: number,
  ) {
    return this.svc.getProblemDetailByRoomId(roomId, pid);
  }

  /** 8) 방별 문제 정보 일부 수정 (호스트만) */
  @Patch('rooms/:roomId/problems/:pid')
  updateProblemDetailByRoomId(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Param('pid', ParseIntPipe) pid: number,
    @Body() dto: UpdateProblemDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.id;
    return this.svc.updateProblemDetailByRoomId(roomId, pid, dto, userId);
  }

  /** 9) 방에서 문제 제거 (호스트만) - DB 문제는 삭제하지 않고 방-문제 연결만 제거 */
  @Delete('rooms/:roomId/problems/:pid')
  @UseGuards(JwtAuthGuard)
  removeProblemFromRoom(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Param('pid', ParseIntPipe) pid: number,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.id;
    return this.svc.removeProblemFromRoom(roomId, pid, userId);
  }

  /** 11) DB에서 문제 영구 삭제 (생성자만) */
  @Delete('db/problems/:problemId')
  @UseGuards(JwtAuthGuard)
  deleteProblem(
    @Param('problemId', ParseIntPipe) problemId: number,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.id;
    return this.svc.deleteProblem(problemId, userId);
  }
}
