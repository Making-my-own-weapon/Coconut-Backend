// src/backend/problems/problems.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { ProblemsService } from './problems.service';
import { CreateDbProblemDto } from './dtos/create-db-problem.dto';
import { AssignRoomProblemDto } from './dtos/assign-room-problem.dto';
import { UpdateProblemDto } from './dtos/update-problem.dto';

@Controller('api/v1')
export class ProblemsController {
  constructor(private readonly svc: ProblemsService) {}

  /** 1) DB에 새 문제 생성 */
  @Post('db/problems')
  createProblem(@Body() dto: CreateDbProblemDto) {
    return this.svc.createProblem(dto);
  }

  /** 2) 방에 문제 할당 */
  @Post('rooms/:roomId/problems')
  assignProblemToRoom(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body() dto: AssignRoomProblemDto,
  ) {
    return this.svc.assignProblemToRoom(roomId, dto);
  }

  /** 3) DB의 모든 문제 목록 조회 */
  @Get('db/problems')
  getAllProblems() {
    return this.svc.getAllProblems();
  }

  /** 4) 방별 문제 목록 조회 */
  @Get('rooms/:roomId/problems')
  getProblemsByRoomId(@Param('roomId', ParseIntPipe) roomId: number) {
    return this.svc.getProblemsByRoomId(roomId);
  }

  /** 5) 방별 특정 문제 상세 조회 */
  @Get('rooms/:roomId/problems/:pid')
  getProblemDetailByRoodId(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Param('pid', ParseIntPipe) pid: number,
  ) {
    return this.svc.getProblemDetailByRoodId(roomId, pid);
  }

  /** 6) 방별 문제 정보 일부 수정 */
  @Patch('rooms/:roomId/problems/:pid')
  updateProblemDetailByRoomId(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Param('pid', ParseIntPipe) pid: number,
    @Body() dto: UpdateProblemDto,
  ) {
    return this.svc.updateProblemDetailByRoomId(roomId, pid, dto);
  }
}
