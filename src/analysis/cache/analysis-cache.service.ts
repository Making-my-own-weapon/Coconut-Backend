import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { TreeSitterParserService } from './tree-sitter-parser.service';
import { RealtimeAnalysisResponseDto } from '../dto/realtime-analysis.dto';

// Tree-sitter 관련 타입 정의
interface TreeSitterTree {
  rootNode: unknown;
}

interface ParsingStats {
  nodeCount: number;
  errorCount: number;
  depth: number;
}

interface CacheError {
  message?: string;
}

@Injectable()
export class AnalysisCacheService {
  private readonly logger = new Logger(AnalysisCacheService.name);
  private redis: Redis;

  constructor(
    private configService: ConfigService,
    private treeSitterParser: TreeSitterParserService,
  ) {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
    });

    this.logger.log('🔄 Analysis cache service initialized');
  }

  /**
   * 캐시에서 분석 결과 조회
   */
  async getCachedAnalysis(
    problemId: string,
    studentCode: string,
  ): Promise<RealtimeAnalysisResponseDto | null> {
    try {
      const cacheStart = Date.now();

      // 구조적 해시 생성
      const structuralHash = this.generateStructuralHash(studentCode);
      const cacheKey = `analysis:${problemId}:tree:${structuralHash}`;

      // Redis에서 조회
      const cached = await this.redis.get(cacheKey);
      const cacheEnd = Date.now();

      this.logger.log(`🔍 Cache lookup took: ${cacheEnd - cacheStart}ms`);
      this.logger.log(`🔑 Cache key: ${cacheKey}`);

      if (cached) {
        this.logger.log('✅ Cache HIT - returning cached result');
        return JSON.parse(cached) as RealtimeAnalysisResponseDto;
      } else {
        this.logger.log('❌ Cache MISS - will need AI call');
        return null;
      }
    } catch (error) {
      const cacheError = error as CacheError;
      this.logger.error('Cache lookup failed:', cacheError.message);
      return null; // 캐시 실패 시 AI 호출로 폴백
    }
  }

  /**
   * 분석 결과를 캐시에 저장
   */
  async saveCachedAnalysis(
    problemId: string,
    studentCode: string,
    analysisResult: RealtimeAnalysisResponseDto,
    ttlDays: number = 7,
  ): Promise<void> {
    try {
      const saveStart = Date.now();

      // 구조적 해시 생성
      const structuralHash = this.generateStructuralHash(studentCode);
      const cacheKey = `analysis:${problemId}:tree:${structuralHash}`;

      // TTL 계산 (기본 7일)
      const ttlSeconds = ttlDays * 24 * 60 * 60;

      // Redis에 저장
      await this.redis.setex(
        cacheKey,
        ttlSeconds,
        JSON.stringify(analysisResult),
      );

      const saveEnd = Date.now();
      this.logger.log(`💾 Cache save took: ${saveEnd - saveStart}ms`);
      this.logger.log(`💾 Saved to cache with TTL: ${ttlDays} days`);
    } catch (error) {
      const cacheError = error as CacheError;
      this.logger.error('Cache save failed:', cacheError.message);
      // 캐시 저장 실패는 치명적이지 않으므로 에러를 던지지 않음
    }
  }

  /**
   * Tree-sitter 기반 구조적 해시 생성
   */
  private generateStructuralHash(code: string): string {
    try {
      const hashStart = Date.now();

      // Tree-sitter로 파싱
      const tree = this.treeSitterParser.parseCode(code) as TreeSitterTree;

      // 구조적 지문 추출
      const structuralFingerprint =
        this.treeSitterParser.extractStructuralFingerprint(tree.rootNode);

      // 파싱 통계 로깅
      const stats = this.treeSitterParser.getParsingStats(tree) as ParsingStats;
      this.logger.log(
        `📊 Parsing stats - Nodes: ${stats.nodeCount}, Errors: ${stats.errorCount}, Depth: ${stats.depth}`,
      );

      // MD5 해시 생성
      const hash = createHash('md5')
        .update(structuralFingerprint)
        .digest('hex');

      const hashEnd = Date.now();
      this.logger.log(
        `🔐 Structural hash generation took: ${hashEnd - hashStart}ms`,
      );

      return hash;
    } catch (error) {
      const hashError = error as CacheError;
      this.logger.warn(
        'Tree-sitter hashing failed, falling back to simple hash:',
        hashError.message,
      );

      // 폴백: 단순 문자열 해시
      return createHash('md5').update(code.trim()).digest('hex');
    }
  }

  /**
   * 캐시 통계 정보 조회
   */
  async getCacheStats(): Promise<{ totalKeys: number; memoryUsage: string }> {
    try {
      const info = await this.redis.info('memory');
      const keyCount = await this.redis.dbsize();

      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'unknown';

      return {
        totalKeys: keyCount,
        memoryUsage: memoryUsage,
      };
    } catch (error) {
      const statsError = error as CacheError;
      this.logger.error('Failed to get cache stats:', statsError.message);
      return { totalKeys: 0, memoryUsage: 'unknown' };
    }
  }

  /**
   * 특정 문제의 캐시 삭제
   */
  async clearCacheForProblem(problemId: string): Promise<number> {
    try {
      const pattern = `analysis:${problemId}:tree:*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        const deletedCount = await this.redis.del(...keys);
        this.logger.log(
          `🗑️ Cleared ${deletedCount} cache entries for problem ${problemId}`,
        );
        return deletedCount;
      }

      return 0;
    } catch (error) {
      const clearError = error as CacheError;
      this.logger.error('Failed to clear cache:', clearError.message);
      return 0;
    }
  }

  /**
   * 전체 분석 캐시 삭제
   */
  async clearAllAnalysisCache(): Promise<number> {
    try {
      const pattern = 'analysis:*:tree:*';
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        const deletedCount = await this.redis.del(...keys);
        this.logger.log(
          `🗑️ Cleared ${deletedCount} total analysis cache entries`,
        );
        return deletedCount;
      }

      return 0;
    } catch (error) {
      const clearAllError = error as CacheError;
      this.logger.error('Failed to clear all cache:', clearAllError.message);
      return 0;
    }
  }
}
