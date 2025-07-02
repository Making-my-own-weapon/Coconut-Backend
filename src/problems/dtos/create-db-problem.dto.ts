// src/backend/problems/dtos/create-db-problem.dto.ts

import {
  IsString,
  IsInt,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProblemSource } from '../entities/problem.entity';

class TestCaseDto {
  @IsString()
  input: string;

  @IsString()
  output: string;
}

export class CreateDbProblemDto {
  @IsString()
  title: string;

  /** 실행 제한시간(ms) */
  @IsInt()
  timeLimitMs: number;

  /** 메모리 제한(KB) */
  @IsInt()
  memoryLimitKb: number;

  /** 풀이 제한(분) */
  @IsOptional()
  @IsInt()
  solveTimeLimitMin?: number;

  /** 문제 설명 */
  @IsString()
  description: string;

  /** 출처 (My 또는 BOJ) */
  @IsEnum(ProblemSource)
  source: ProblemSource;

  /** 카테고리 배열 */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  categories: string[];

  /** 테스트케이스 목록 */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestCaseDto)
  testCases: TestCaseDto[];
}
