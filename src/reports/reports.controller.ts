import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface RequestWithUser extends Request {
  user: {
    id: number;
    email: string;
  };
}

@Controller('api/v1/reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * 리포트를 저장합니다
   */
  @Post('save/:roomId')
  async saveReport(
    @Param('roomId') roomId: string,
    @Req() req: RequestWithUser,
  ) {
    const savedReport = await this.reportsService.saveReport(
      Number(roomId),
      req.user.id,
    );
    return {
      success: true,
      data: {
        id: savedReport.id,
        roomTitle: savedReport.room_title,
        savedAt: savedReport.saved_at,
      },
    };
  }

  /**
   * 사용자의 저장된 리포트 목록을 조회합니다
   */
  @Get('saved')
  async getUserSavedReports(@Req() req: RequestWithUser) {
    const reports = await this.reportsService.getUserSavedReports(req.user.id);
    return {
      success: true,
      data: reports,
    };
  }

  /**
   * 저장된 리포트 상세 데이터를 조회합니다
   */
  @Get('saved/:reportId')
  async getSavedReportDetail(
    @Param('reportId') reportId: string,
    @Req() req: RequestWithUser,
  ) {
    const report = await this.reportsService.getSavedReportDetail(
      Number(reportId),
      req.user.id,
    );

    if (!report) {
      return {
        success: false,
        message: '저장된 리포트를 찾을 수 없습니다.',
      };
    }

    return {
      success: true,
      data: report,
    };
  }

  /**
   * 저장된 리포트를 삭제합니다
   */
  @Delete('saved/:reportId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSavedReport(
    @Param('reportId') reportId: string,
    @Req() req: RequestWithUser,
  ) {
    const success = await this.reportsService.deleteSavedReport(
      Number(reportId),
      req.user.id,
    );

    if (!success) {
      return {
        success: false,
        message: '리포트 삭제에 실패했습니다.',
      };
    }

    return { success: true };
  }
}
