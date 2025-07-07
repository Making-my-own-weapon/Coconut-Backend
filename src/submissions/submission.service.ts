import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Submission } from './entities/submission.entity';
import { Testcase } from './entities/testcase.entity';
import { Problem } from '../problems/entities/problem.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';

@Injectable()
export class SubmissionService {
  private sqsClient: SQSClient;
  private readonly QUEUE_URL =
    'https://sqs.ap-northeast-2.amazonaws.com/928747727316/coconut-grading-light-queue';

  constructor(
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
    @InjectRepository(Testcase)
    private testcaseRepository: Repository<Testcase>,
    @InjectRepository(Problem)
    private problemRepository: Repository<Problem>,
  ) {
    // AWS SQS 클라이언트 초기화
    this.sqsClient = new SQSClient({
      region: 'ap-northeast-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  async createSubmission(
    userId: number,
    roomId: number,
    createSubmissionDto: CreateSubmissionDto,
  ): Promise<{ submission_id: number }> {
    // 1단계: DB에 PENDING 상태로 submission 생성
    const submission = this.submissionRepository.create({
      user_id: userId,
      room_id: roomId,
      problem_id: createSubmissionDto.pid,
      code: createSubmissionDto.code,
      language: createSubmissionDto.language,
      status: 'PENDING',
      is_passed: false,
      passed_tc_count: 0,
      total_tc_count: 0,
      execution_time_ms: 0,
      memory_usage_kb: 0,
    });

    const savedSubmission = await this.submissionRepository.save(submission);

    // 2단계: SQS에 채점 메시지 전송
    await this.sendGradingMessage(savedSubmission);

    return { submission_id: savedSubmission.submission_id };
  }

  async findSubmissionById(submissionId: number): Promise<Submission> {
    const submission = await this.submissionRepository.findOne({
      where: { submission_id: submissionId },
      relations: ['user', 'room', 'problem'],
    });

    if (!submission) {
      throw new NotFoundException(
        `Submission with ID ${submissionId} not found`,
      );
    }

    return submission;
  }

  private async sendGradingMessage(submission: Submission): Promise<void> {
    // DB에서 해당 문제 정보 조회 (제한시간 포함)
    const problem = await this.problemRepository.findOne({
      where: { problemId: parseInt(submission.problem_id) },
    });

    if (!problem) {
      throw new Error(`Problem ${submission.problem_id}를 찾을 수 없습니다.`);
    }

    // DB에서 해당 문제의 모든 테스트케이스 조회
    const testcases = await this.testcaseRepository.find({
      where: { problem_id: submission.problem_id },
      order: { testcase_id: 'ASC' },
    });

    if (testcases.length === 0) {
      throw new Error(
        `Problem ${submission.problem_id}에 대한 테스트케이스가 없습니다.`,
      );
    }

    // 테스트케이스 키 배열 생성
    const testcase_keys = testcases.map((tc) => [tc.input_tc, tc.output_tc]);

    const message = {
      submission_id: submission.submission_id,
      problem_id: parseInt(submission.problem_id), // string을 number로 변환
      code: submission.code,
      language: submission.language, // 언어 정보 추가
      time_limit_ms: problem.executionTimeLimitMs, // DB에서 가져온 실제 제한시간
      testcase_keys: testcase_keys,
    };

    const command = new SendMessageCommand({
      QueueUrl: this.QUEUE_URL,
      MessageBody: JSON.stringify(message),
    });

    try {
      await this.sqsClient.send(command);
      console.log(
        `SQS 메시지 전송 성공: submission_id=${submission.submission_id}, 테스트케이스 ${testcases.length}개`,
      );
    } catch (error) {
      console.error('SQS 메시지 전송 실패:', error);
      throw error;
    }
  }

  // Lambda에서 채점 결과 업데이트용 (내부 API)
  async updateSubmissionResult(
    submissionId: number,
    result: {
      status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAIL';
      is_passed: boolean;
      passed_tc_count: number;
      total_tc_count: number;
      execution_time_ms: number;
      memory_usage_kb: number;
      stdout: string;
    },
  ): Promise<void> {
    const submission = await this.submissionRepository.findOne({
      where: { submission_id: submissionId },
    });

    if (!submission) {
      throw new NotFoundException(
        `Submission with ID ${submissionId} not found`,
      );
    }

    await this.submissionRepository.update(submissionId, {
      status: result.status,
      is_passed: result.is_passed,
      passed_tc_count: result.passed_tc_count,
      total_tc_count: result.total_tc_count,
      execution_time_ms: result.execution_time_ms,
      memory_usage_kb: result.memory_usage_kb,
      stdout: result.stdout,
    });
  }
}
