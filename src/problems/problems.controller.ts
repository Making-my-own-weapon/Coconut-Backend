// src/backend/problems/problems.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ProblemsService } from './problems.service';
import { CreateDbProblemDto } from './dtos/create-db-problem.dto';
import { AssignRoomProblemDto } from './dtos/assign-room-problem.dto';
import { UpdateProblemDto } from './dtos/update-problem.dto';
import { ProblemSummaryDto } from './dtos/problem-summary.dto';

interface RequestWithUser extends Request {
  user: { id: number };
}

@Controller('api/v1')
export class ProblemsController {
  constructor(private readonly svc: ProblemsService) {}

  /** 1) DB에 새 문제 생성 */
  @Post('db/problems')
  createProblem(@Body() dto: CreateDbProblemDto) {
    return this.svc.createProblem(dto);
  }

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

  /** 5) 방별 문제 목록 조회 */
  @Get('rooms/:roomId/problems')
  getProblemsByRoomId(@Param('roomId', ParseIntPipe) roomId: number) {
    return this.svc.getProblemsByRoomId(roomId);
  }

  /** 6) 방별 특정 문제 상세 조회 */
  @Get('rooms/:roomId/problems/:pid')
  getProblemDetailByRoomId(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Param('pid', ParseIntPipe) pid: number,
  ) {
    return this.svc.getProblemDetailByRoomId(roomId, pid);
  }

  /** 7) 방별 문제 정보 일부 수정 (호스트만) */
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
}
