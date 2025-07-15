import { IsString, IsNotEmpty } from 'class-validator';

export class RealtimeAnalysisRequestDto {
  @IsString()
  @IsNotEmpty()
  problemId: string;

  @IsString()
  @IsNotEmpty()
  studentCode: string;
}

export class RealtimeAnalysisResponseDto {
  realtime_hints: string[];
  analysis: {
    approach: string;
  };
  recommendation: string;
}
