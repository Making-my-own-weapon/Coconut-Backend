import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SavedReport } from './entities/saved-report.entity';
import { Room } from '../rooms/entities/room.entity';
import { RoomProblem } from '../problems/entities/room-problem.entity';
import { Problem } from '../problems/entities/problem.entity';
import { Submission } from '../submissions/entities/submission.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(SavedReport)
    private readonly savedReportRepository: Repository<SavedReport>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(RoomProblem)
    private readonly roomProblemRepository: Repository<RoomProblem>,
    @InjectRepository(Problem)
    private readonly problemRepository: Repository<Problem>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * 리포트를 저장합니다
   */
  async saveReport(roomId: number, userId: number): Promise<SavedReport> {
    // 1. 현재 리포트 데이터를 가져옵니다 (RoomsService의 getRoomReport 로직을 직접 구현)
    const reportData = await this.getRoomReportData(roomId);

    // 2. 저장된 리포트 엔티티를 생성합니다
    const savedReport = this.savedReportRepository.create({
      user_id: userId,
      room_title: reportData.roomTitle,
      report_data: reportData,
    });

    // 3. 데이터베이스에 저장합니다
    return await this.savedReportRepository.save(savedReport);
  }

  /**
   * 방 리포트 데이터를 가져오는 메서드 (RoomsService의 getRoomReport 로직 복사)
   */
  private async getRoomReportData(roomId: number) {
    // 방 정보 조회
    const room = await this.roomRepository.findOne({
      where: { roomId: roomId },
      // relations: ['participants', 'participants.user'], // ❌ 이 부분이 문제! participants는 관계가 아니라 JSON 컬럼이므로 제거해야 함
    });

    if (!room) {
      throw new Error('방을 찾을 수 없습니다.');
    }

    // 방의 문제들 조회 (relations 제거)
    const roomProblems = await this.roomProblemRepository.find({
      where: { roomId: roomId },
      // relations: ['problem'], // ❌ RoomProblem에 problem 관계가 없어서 제거
    });

    const problemIds = roomProblems.map((rp) => rp.problemId);
    const problems = await this.problemRepository.find({
      where: { problemId: In(problemIds) },
    });

    // 제출 데이터 조회
    const submissions = await this.submissionRepository.find({
      where: { problem_id: In(problemIds) },
      relations: ['user', 'problem'],
    });

    // 학생들 조회 (participants는 JSON 컬럼이므로 바로 접근)
    const students = (room.participants || []).filter(
      (p) => p.userType === 'student',
    );

    // 기본 통계 계산
    const totalSubmissions = submissions.length;
    const passedSubmissions = submissions.filter((s) => s.is_passed);
    const averageSuccessRate =
      totalSubmissions > 0
        ? Math.round((passedSubmissions.length / totalSubmissions) * 100)
        : 0;

    // 학생별 정답률 계산
    const studentSubmissions = students.map((student) => {
      const studentSubs = submissions.filter(
        (s) => s.user_id === student.userId,
      );
      const studentPassed = studentSubs.filter((s) => s.is_passed);
      const successRate =
        studentSubs.length > 0
          ? Math.round((studentPassed.length / studentSubs.length) * 100)
          : 0;

      return {
        name: student.name,
        successRate,
      };
    });

    return {
      roomTitle: room.title,
      averageSuccessRate,
      averageSolveTime: '00:00:00', // 기본값
      totalSubmissions,
      totalProblems: problems.length,
      totalStudents: students.length,
      hardestProblem: { name: 'N/A', rate: 0 },
      easiestProblem: { name: 'N/A', rate: 0 },
      problemAnalysis: [],
      categoryAnalysis: [],
      bestCategory: { name: 'N/A', successRate: 0 },
      worstCategory: { name: 'N/A', successRate: 0 },
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
        stdout: sub.stdout,
        created_at: sub.created_at,
        user: sub.user,
        problem: sub.problem,
      })),
      classTime: room.endTime || '00:00:00',
      classStatus: room.status,
    };
  }

  /**
   * 사용자의 저장된 리포트 목록을 조회합니다
   */
  async getUserSavedReports(userId: number): Promise<SavedReport[]> {
    return await this.savedReportRepository.find({
      where: { user_id: userId },
      order: { saved_at: 'DESC' }, // 최신순으로 정렬
      select: ['id', 'room_title', 'saved_at'], // 목록에서는 데이터 전체는 제외
    });
  }

  /**
   * 저장된 리포트 상세 데이터를 조회합니다
   */
  async getSavedReportDetail(
    reportId: number,
    userId: number,
  ): Promise<SavedReport | null> {
    return await this.savedReportRepository.findOne({
      where: { id: reportId, user_id: userId },
    });
  }

  /**
   * 저장된 리포트를 삭제합니다
   */
  async deleteSavedReport(reportId: number, userId: number): Promise<boolean> {
    const result = await this.savedReportRepository.delete({
      id: reportId,
      user_id: userId,
    });
    return (result.affected ?? 0) > 0;
  }
}
