import { IsString, IsNotEmpty } from 'class-validator';

export class DetailedAnalysisRequestDto {
  @IsString()
  @IsNotEmpty()
  problemId: string;

  @IsString()
  @IsNotEmpty()
  studentCode: string;

  @IsString()
  staticAnalysisResult: string; // pyflakes 등 정적 분석 결과
}

export class DetailedAnalysisResponseDto {
  analysis: {
    approach: string;
    pros: string;
    cons: string;
  };
  recommendation: string;
}
