import { Controller, Post, Body } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { RealtimeAnalysisRequestDto, RealtimeAnalysisResponseDto } from './dto/realtime-analysis.dto';
import { DetailedAnalysisRequestDto, DetailedAnalysisResponseDto } from './dto/detailed-analysis.dto';

@Controller('api/v1/analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post('realtime')
  async getRealtimeAnalysis(
    @Body() dto: RealtimeAnalysisRequestDto,
  ): Promise<RealtimeAnalysisResponseDto> {
    return this.analysisService.getRealtimeAnalysis(dto.problemId, dto.studentCode);
  }

  @Post('detailed')
  async getDetailedAnalysis(
    @Body() dto: DetailedAnalysisRequestDto,
  ): Promise<DetailedAnalysisResponseDto> {
    return this.analysisService.getDetailedAnalysis(
      dto.problemId, 
      dto.studentCode, 
      dto.staticAnalysisResult
    );
  }

}