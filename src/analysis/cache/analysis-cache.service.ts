import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { TreeSitterParserService } from './tree-sitter-parser.service';
import { RealtimeAnalysisResponseDto } from '../dto/realtime-analysis.dto';

// Tree-sitter 관련 타입 정의
interface TreeSitterNode {
  type: string;
  text?: string;
  children?: TreeSitterNode[];
  rootNode?: TreeSitterNode;
}

interface TreeSitterTree {
  rootNode: TreeSitterNode;
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
      host: this.configService.get<string>(
        'REDIS_HOST',
        'coconut-cache-jos2tj.serverless.apn2.cache.amazonaws.com',
      ),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      // 타임아웃 설정 추가
      connectTimeout: 1000, // 2초 연결 타임아웃
      commandTimeout: 1000, // 2초 명령어 타임아웃
      lazyConnect: true, // 필요할 때만 연결
    });

    this.logger.log(
      '🔄 Analysis cache service initialized with timeout settings',
    );
  }

  /**
   * 캐시에서 분석 결과 조회 (2초 타임아웃 적용)
   */
  async getCachedAnalysis(
    problemId: string,
    studentCode: string,
  ): Promise<RealtimeAnalysisResponseDto | null> {
    try {
      const cacheStart = Date.now();

      // 2초 타임아웃으로 캐시 조회
      const cachePromise = this.performCacheLookup(problemId, studentCode);
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
          this.logger.warn(
            '⏰ Cache lookup timeout (2s) - falling back to LLM',
          );
          resolve(null);
        }, 2000);
      });

      const result = await Promise.race([cachePromise, timeoutPromise]);
      const cacheEnd = Date.now();

      this.logger.log(`🔍 Cache operation took: ${cacheEnd - cacheStart}ms`);

      return result;
    } catch (error) {
      const cacheError = error as CacheError;
      this.logger.error('Cache lookup failed:', cacheError.message);
      this.logger.log('🔄 Falling back to LLM due to cache error');
      return null; // 캐시 실패 시 AI 호출로 폴백
    }
  }

  /**
   * 실제 캐시 조회 수행
   */
  private async performCacheLookup(
    problemId: string,
    studentCode: string,
  ): Promise<RealtimeAnalysisResponseDto | null> {
    try {
      // 구조적 해시 생성 (1초 타임아웃)
      const hashPromise = this.generateStructuralHashWithTimeout(studentCode);
      const hashTimeoutPromise = new Promise<string>((resolve) => {
        setTimeout(() => {
          this.logger.warn(
            '⏰ Hash generation timeout (1s) - using simple hash',
          );
          resolve(this.generateSimpleHash(studentCode));
        }, 1000);
      });

      const structuralHash = await Promise.race([
        hashPromise,
        hashTimeoutPromise,
      ]);
      const cacheKey = `analysis:${problemId}:tree:${structuralHash}`;

      // Redis에서 조회
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        this.logger.log('✅ Cache HIT - returning cached result');
        return JSON.parse(cached) as RealtimeAnalysisResponseDto;
      } else {
        this.logger.log('❌ Cache MISS - will need AI call');
        return null;
      }
    } catch (error) {
      const lookupError = error as CacheError;
      this.logger.error('Cache lookup operation failed:', lookupError.message);
      return null;
    }
  }

  /**
   * 타임아웃이 적용된 구조적 해시 생성
   */
  private async generateStructuralHashWithTimeout(
    code: string,
  ): Promise<string> {
    try {
      const hashStart = Date.now();

      // Tree-sitter로 파싱 (1초 타임아웃)
      const parsePromise = this.treeSitterParser.parseCodeWithTimeout(code);
      const parseTimeoutPromise = new Promise<TreeSitterTree>(
        (resolve, reject) => {
          setTimeout(() => {
            reject(new Error('Tree-sitter parsing timeout'));
          }, 1000);
        },
      );

      const tree = await Promise.race([parsePromise, parseTimeoutPromise]);

      // 구조적 지문 추출
      const structuralFingerprint =
        this.treeSitterParser.extractStructuralFingerprint(tree.rootNode);

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
      return this.generateSimpleHash(code);
    }
  }

  /**
   * 단순 문자열 해시 생성 (폴백용)
   */
  private generateSimpleHash(code: string): string {
    return createHash('md5').update(code.trim()).digest('hex');
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

      // 타임아웃 기반 구조적 해시 생성 (조회와 동일한 방식)
      const hashPromise = this.generateStructuralHashWithTimeout(studentCode);
      const hashTimeoutPromise = new Promise<string>((resolve) => {
        setTimeout(() => {
          this.logger.warn(
            '⏰ Hash generation timeout (1s) - using simple hash for save',
          );
          resolve(this.generateSimpleHash(studentCode));
        }, 1000);
      });

      const structuralHash = await Promise.race([
        hashPromise,
        hashTimeoutPromise,
      ]);
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
    } catch (error) {
      const cacheError = error as CacheError;
      this.logger.error('Cache save failed:', cacheError.message);
      // 캐시 저장 실패는 치명적이지 않으므로 에러를 던지지 않음
    }
  }

  /**
   * Tree-sitter 기반 구조적 해시 생성 (기존 메서드 - 호환성 유지)
   */
  private generateStructuralHash(code: string): string {
    // 새로운 타임아웃 기반 메서드로 위임
    return this.generateSimpleHash(code);
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

  /**
   * 캐시 디버깅을 위한 메서드
   */
  async debugCacheForProblem(problemId: string): Promise<void> {
    try {
      const pattern = `analysis:${problemId}:tree:*`;
      const keys = await this.redis.keys(pattern);

      this.logger.log(
        `🔍 Found ${keys.length} cache entries for problem ${problemId}`,
      );

      for (const key of keys) {
        const value = await this.redis.get(key);
        const ttl = await this.redis.ttl(key);
        this.logger.log(
          `🔑 Key: ${key}, TTL: ${ttl}s, Size: ${value?.length || 0} chars`,
        );
      }
    } catch (error) {
      const debugError = error as CacheError;
      this.logger.error('Failed to debug cache:', debugError.message);
    }
  }
}
