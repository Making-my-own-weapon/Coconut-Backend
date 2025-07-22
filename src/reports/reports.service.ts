import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SavedReport } from './entities/saved-report.entity';
import { Room } from '../rooms/entities/room.entity';
import { RoomProblem } from '../problems/entities/room-problem.entity';
import { Problem } from '../problems/entities/problem.entity';
import { Submission } from '../submissions/entities/submission.entity';
import { User } from '../users/entities/user.entity';
import { RoomsService } from '../rooms/rooms.service';

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
    private readonly roomsService: RoomsService,
  ) {}

  /**
   * 리포트를 저장합니다
   */
  async saveReport(roomId: number, userId: number): Promise<SavedReport> {
    // 1. 방 정보 조회하여 방 생성자인지 확인
    const room = await this.roomRepository.findOne({
      where: { roomId: roomId },
    });

    if (!room) {
      throw new Error('방을 찾을 수 없습니다.');
    }

    // 2. 방 생성자인지 확인
    const isRoomCreator = room.creatorId === userId;

    // 3. 방 생성자라면 선생님 리포트, 아니면 학생 리포트 데이터를 가져옵니다
    const reportData = isRoomCreator
      ? await this.getTeacherReportData(roomId)
      : await this.getStudentReportData(roomId, userId);

    // 4. 저장된 리포트 엔티티를 생성합니다
    const savedReport = this.savedReportRepository.create({
      user_id: userId,
      room_title: reportData.roomTitle,
      report_data: reportData,
      report_type: isRoomCreator ? 'teacher' : 'student', // 리포트 타입 추가
    });

    // 5. 데이터베이스에 저장합니다
    return await this.savedReportRepository.save(savedReport);
  }

  /**
   * 선생님 리포트 데이터를 가져오는 메서드 (전체 수업 통계)
   */
  private async getTeacherReportData(roomId: number) {
    // RoomsService의 getRoomReport 메서드를 사용하여 선생님 리포트 데이터를 가져옵니다
    return await this.roomsService.getRoomReport(roomId);
  }

  /**
   * 학생 리포트 데이터를 가져오는 메서드 (개별 학생 통계)
   */
  private async getStudentReportData(roomId: number, userId: number) {
    // 방 정보 조회
    const room = await this.roomRepository.findOne({
      where: { roomId: roomId },
    });

    if (!room) {
      throw new Error('방을 찾을 수 없습니다.');
    }

    // 방의 문제들 조회
    const roomProblems = await this.roomProblemRepository.find({
      where: { roomId: roomId },
    });

    const problemIds = roomProblems.map((rp) => rp.problemId);
    const problems = await this.problemRepository.find({
      where: { problemId: In(problemIds) },
    });

    // 해당 학생의 제출 데이터만 조회
    const submissions = await this.submissionRepository.find({
      where: {
        problem_id: In(problemIds),
        user_id: userId,
      },
      relations: ['user', 'problem'],
    });

    // 학생 정보 조회
    const student = (room.participants || []).find((p) => p.userId === userId);
    if (!student) {
      throw new Error('학생 정보를 찾을 수 없습니다.');
    }

    // 기본 통계 계산
    const totalSubmissions = submissions.length;
    const passedSubmissions = submissions.filter((s) => s.is_passed);
    const averageSuccessRate =
      totalSubmissions > 0
        ? Math.round((passedSubmissions.length / totalSubmissions) * 100)
        : 0;

    // 첫 제출에 통과한 문제 수 계산
    const firstSubmissionResults = new Map<string, boolean>();
    submissions
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
      .forEach((submission) => {
        const key = `${submission.user_id}-${submission.problem_id}`;
        if (!firstSubmissionResults.has(key)) {
          firstSubmissionResults.set(key, submission.is_passed);
        }
      });

    const firstSubmissionPassed = Array.from(
      firstSubmissionResults.values(),
    ).filter((passed) => passed).length;

    // 문제별 정답률 계산
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

    // 카테고리별 성과 계산
    const categoryStats = new Map<
      string,
      {
        total: number;
        passed: number;
        problems: Set<string>;
        submissions: Submission[];
      }
    >();

    // 카테고리별 통계 수집
    submissions.forEach((submission) => {
      if (submission.problem && submission.problem.categories) {
        submission.problem.categories.forEach((category) => {
          if (!categoryStats.has(category)) {
            categoryStats.set(category, {
              total: 0,
              passed: 0,
              problems: new Set(),
              submissions: [],
            });
          }
          const stats = categoryStats.get(category)!;
          stats.total++;
          stats.problems.add(submission.problem.title);
          stats.submissions.push(submission);

          if (submission.is_passed) {
            stats.passed++;
          }
        });
      }
    });

    // 카테고리별 정답률 및 상세 정보 계산
    const categoryAnalysis = Array.from(categoryStats.entries()).map(
      ([category, stats]) => {
        const uniqueProblems = Array.from(stats.problems);

        // 첫 제출 성공률 계산
        const firstSubmissionStats = new Map<string, boolean>();
        stats.submissions.forEach((submission) => {
          const key = `${submission.user_id}-${submission.problem_id}`;
          if (!firstSubmissionStats.has(key)) {
            firstSubmissionStats.set(key, submission.is_passed);
          }
        });
        const firstSubmissionSuccesses = Array.from(
          firstSubmissionStats.values(),
        ).filter((passed) => passed).length;
        const firstSubmissionRate =
          firstSubmissionStats.size > 0
            ? Math.round(
                (firstSubmissionSuccesses / firstSubmissionStats.size) * 100,
              )
            : 0;

        return {
          name: category,
          successRate:
            stats.total > 0
              ? Math.round((stats.passed / stats.total) * 100)
              : 0,
          totalSubmissions: stats.total,
          passedSubmissions: stats.passed,
          uniqueProblems: uniqueProblems.length,
          problemTitles: uniqueProblems,
          participatingStudents: 1, // 학생 리포트이므로 1
          studentPerformance: [
            {
              studentId: userId,
              studentName: student.name,
              submissions: stats.submissions.length,
              passed: stats.passed,
              successRate:
                stats.submissions.length > 0
                  ? Math.round((stats.passed / stats.submissions.length) * 100)
                  : 0,
            },
          ],
          firstSubmissionSuccessRate: firstSubmissionRate,
          averageAttemptsPerProblem:
            stats.total / Math.max(uniqueProblems.length, 1),
        };
      },
    );

    // 카테고리 정렬 (정답률 높은 순)
    categoryAnalysis.sort((a, b) => b.successRate - a.successRate);

    // 베스트/워스트 카테고리 찾기
    const categoriesWithData = categoryAnalysis.filter(
      (c) => c.totalSubmissions > 0,
    );
    const bestCategory =
      categoriesWithData.length > 0
        ? categoriesWithData.reduce((max, c) =>
            c.successRate > max.successRate ? c : max,
          )
        : { name: 'N/A', successRate: 0 };
    const worstCategory =
      categoriesWithData.length > 0
        ? categoriesWithData.reduce((min, c) =>
            c.successRate < min.successRate ? c : min,
          )
        : { name: 'N/A', successRate: 0 };

    // 문제별 난이도 분석
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

    return {
      roomTitle: room.title,
      averageSuccessRate,
      averageSolveTime: '00:00:00', // 기본값
      totalSubmissions,
      totalProblems: problems.length,
      totalStudents: 1, // 학생 리포트이므로 1
      firstSubmissionPassed,
      hardestProblem: {
        name: hardestProblem.title || 'N/A',
        rate: hardestProblem.successRate,
      },
      easiestProblem: {
        name: easiestProblem.title || 'N/A',
        rate: easiestProblem.successRate,
      },
      problemAnalysis,
      categoryAnalysis,
      bestCategory,
      worstCategory,
      studentSubmissions: [
        {
          name: student.name,
          successRate: averageSuccessRate,
        },
      ],
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
      problems, // 전체 문제 리스트 추가
      classTime: room.endTime || '00:00:00',
      classStatus: room.status,
    };
  }

  /**
   * 방 리포트 데이터를 가져오는 메서드 (RoomsService의 getRoomReport 로직 복사)
   */
  private async getRoomReportData(roomId: number) {
    // 방 정보 조회
    const room = await this.roomRepository.findOne({
      where: { roomId: roomId },
    });

    if (!room) {
      throw new Error('방을 찾을 수 없습니다.');
    }

    // 방의 문제들 조회
    const roomProblems = await this.roomProblemRepository.find({
      where: { roomId: roomId },
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

    // 첫 제출에 통과한 문제 수 계산
    const firstSubmissionResults = new Map<string, boolean>();
    submissions
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
      .forEach((submission) => {
        const key = `${submission.user_id}-${submission.problem_id}`;
        if (!firstSubmissionResults.has(key)) {
          firstSubmissionResults.set(key, submission.is_passed);
        }
      });

    const firstSubmissionPassed = Array.from(
      firstSubmissionResults.values(),
    ).filter((passed) => passed).length;

    // 문제별 정답률 계산
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

    // 카테고리별 성과 계산
    const categoryStats = new Map<
      string,
      {
        total: number;
        passed: number;
        problems: Set<string>;
        submissions: Submission[];
        students: Set<number>;
      }
    >();

    // 카테고리별 통계 수집
    submissions.forEach((submission) => {
      if (submission.problem && submission.problem.categories) {
        submission.problem.categories.forEach((category) => {
          if (!categoryStats.has(category)) {
            categoryStats.set(category, {
              total: 0,
              passed: 0,
              problems: new Set(),
              submissions: [],
              students: new Set(),
            });
          }
          const stats = categoryStats.get(category)!;
          stats.total++;
          stats.problems.add(submission.problem.title);
          stats.submissions.push(submission);
          stats.students.add(submission.user_id);

          if (submission.is_passed) {
            stats.passed++;
          }
        });
      }
    });

    // 카테고리별 정답률 및 상세 정보 계산
    const categoryAnalysis = Array.from(categoryStats.entries()).map(
      ([category, stats]) => {
        const uniqueProblems = Array.from(stats.problems);

        // 학생별 성과 계산
        const studentPerformance = Array.from(stats.students).map(
          (studentId) => {
            const studentSubmissions = stats.submissions.filter(
              (s) => s.user_id === studentId,
            );
            const studentPassed = studentSubmissions.filter(
              (s) => s.is_passed,
            ).length;
            const student = studentSubmissions[0]?.user;

            return {
              studentId,
              studentName: student?.name || `Student ${studentId}`,
              submissions: studentSubmissions.length,
              passed: studentPassed,
              successRate:
                studentSubmissions.length > 0
                  ? Math.round(
                      (studentPassed / studentSubmissions.length) * 100,
                    )
                  : 0,
            };
          },
        );

        // 첫 제출 성공률 계산
        const firstSubmissionStats = new Map<string, boolean>();
        stats.submissions.forEach((submission) => {
          const key = `${submission.user_id}-${submission.problem_id}`;
          if (!firstSubmissionStats.has(key)) {
            firstSubmissionStats.set(key, submission.is_passed);
          }
        });
        const firstSubmissionSuccesses = Array.from(
          firstSubmissionStats.values(),
        ).filter((passed) => passed).length;
        const firstSubmissionRate =
          firstSubmissionStats.size > 0
            ? Math.round(
                (firstSubmissionSuccesses / firstSubmissionStats.size) * 100,
              )
            : 0;

        return {
          name: category,
          successRate:
            stats.total > 0
              ? Math.round((stats.passed / stats.total) * 100)
              : 0,
          totalSubmissions: stats.total,
          passedSubmissions: stats.passed,
          uniqueProblems: uniqueProblems.length,
          problemTitles: uniqueProblems,
          participatingStudents: stats.students.size,
          studentPerformance: studentPerformance,
          firstSubmissionSuccessRate: firstSubmissionRate,
          averageAttemptsPerProblem:
            stats.total / Math.max(uniqueProblems.length, 1),
        };
      },
    );

    // 카테고리 정렬 (정답률 높은 순)
    categoryAnalysis.sort((a, b) => b.successRate - a.successRate);

    // 베스트/워스트 카테고리 찾기
    const categoriesWithData = categoryAnalysis.filter(
      (c) => c.totalSubmissions > 0,
    );
    const bestCategory =
      categoriesWithData.length > 0
        ? categoriesWithData.reduce((max, c) =>
            c.successRate > max.successRate ? c : max,
          )
        : { name: 'N/A', successRate: 0 };
    const worstCategory =
      categoriesWithData.length > 0
        ? categoriesWithData.reduce((min, c) =>
            c.successRate < min.successRate ? c : min,
          )
        : { name: 'N/A', successRate: 0 };

    // 문제별 난이도 분석
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
      firstSubmissionPassed,
      hardestProblem: {
        name: hardestProblem.title || 'N/A',
        rate: hardestProblem.successRate,
      },
      easiestProblem: {
        name: easiestProblem.title || 'N/A',
        rate: easiestProblem.successRate,
      },
      problemAnalysis,
      categoryAnalysis,
      bestCategory,
      worstCategory,
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
      problems, // 전체 문제 리스트 추가
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
