// src/backend/problems/dtos/problem-summary.dto.ts
export class ProblemSummaryDto {
  problemId: number;
  title: string;
  source: 'My' | 'BOJ';
  categories: string[];
}
