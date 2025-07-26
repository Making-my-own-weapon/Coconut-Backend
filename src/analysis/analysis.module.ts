import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { AnalysisCacheService } from './cache/analysis-cache.service';
import { TreeSitterParserService } from './cache/tree-sitter-parser.service';
import { GeminiService } from './gemini.service';
import { Problem } from '../problems/entities/problem.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Problem])],
  controllers: [AnalysisController],
  providers: [
    AnalysisService,
    AnalysisCacheService,
    TreeSitterParserService,
    GeminiService,
  ],
  exports: [AnalysisService],
})
export class AnalysisModule {}
