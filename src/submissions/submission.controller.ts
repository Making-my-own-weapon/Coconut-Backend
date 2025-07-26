import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
  HttpStatus,
} from '@nestjs/common';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    email: string;
    name: string;
  };
}
import { SubmissionService } from './submission.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class SubmissionController {
  constructor(private readonly submissionService: SubmissionService) {}

  // POST /api/v1/rooms/{roomId}/submissions
  @Post('rooms/:roomId/submissions')
  async createSubmission(
    @Request() req: AuthenticatedRequest,
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body() createSubmissionDto: CreateSubmissionDto,
  ) {
    const userId = req.user.id; // JWT에서 추출된 사용자 ID

    const result = await this.submissionService.createSubmission(
      userId,
      roomId,
      createSubmissionDto,
    );

    return {
      statusCode: HttpStatus.ACCEPTED,
      message: '제출이 접수되었습니다. 채점이 진행 중입니다.',
      data: result,
    };
  }

  // GET /api/v1/submissions/{submissionId}
  @Get('submissions/:submissionId')
  async getSubmissionResult(
    @Request() req: AuthenticatedRequest,
    @Param('submissionId', ParseIntPipe) submissionId: number,
  ) {
    const submission =
      await this.submissionService.findSubmissionById(submissionId);

    // 작성자 본인만 조회 가능 (보안)
    if (submission.user_id !== req.user.id) {
      return {
        statusCode: HttpStatus.FORBIDDEN,
        message: '본인의 제출만 조회할 수 있습니다.',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      data: {
        submissionId: submission.submission_id,
        status: submission.status,
        isPassed: submission.is_passed,
        passedTestCount: submission.passed_tc_count,
        totalTestCount: submission.total_tc_count,
        executionTimeMs: submission.execution_time_ms,
        memoryUsageKb: submission.memory_usage_kb,
        output: submission.stdout,
        createdAt: submission.created_at,
        updatedAt: submission.updated_at,
      },
    };
  }

  // PATCH /api/v1/submissions/{submissionId}/result (Lambda 전용)
  @Post('submissions/:submissionId/result')
  async updateSubmissionResult(
    @Param('submissionId', ParseIntPipe) submissionId: number,
    @Body()
    resultDto: {
      status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAIL';
      is_passed: boolean;
      passed_tc_count: number;
      total_tc_count: number;
      execution_time_ms: number;
      memory_usage_kb: number;
      stdout: string;
    },
  ) {
    await this.submissionService.updateSubmissionResult(
      submissionId,
      resultDto,
    );

    return {
      statusCode: HttpStatus.OK,
      message: '채점 결과가 업데이트되었습니다.',
    };
  }
}
