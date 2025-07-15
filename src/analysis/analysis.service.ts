import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { RealtimeAnalysisResponseDto } from './dto/realtime-analysis.dto';
import { DetailedAnalysisResponseDto } from './dto/detailed-analysis.dto';
import { Problem } from '../problems/entities/problem.entity';
import { AnalysisCacheService } from './cache/analysis-cache.service';

// Bedrock 응답 타입 정의
interface BedrockResponseBody {
  output?: {
    message?: {
      content?: Array<{ text?: string }>;
    };
  };
  content?: Array<{ text?: string }>;
}

interface BedrockError {
  message?: string;
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);
  private bedrock: BedrockRuntimeClient;

  constructor(
    private configService: ConfigService,
    private cacheService: AnalysisCacheService,
    @InjectRepository(Problem)
    private problemRepository: Repository<Problem>,
  ) {
    const bedrockApiKey = this.configService.get<string>('BEDROCK_API_KEY');

    if (!bedrockApiKey) {
      throw new Error('BEDROCK_API_KEY not found in environment variables');
    }

    // Bedrock API Key 디코딩 디버그
    try {
      console.log('Original API Key:', bedrockApiKey.substring(0, 20) + '...');
      const decodedKey = Buffer.from(bedrockApiKey, 'base64').toString('utf-8');
      console.log('Decoded key:', decodedKey);

      // 일반적인 AWS 자격 증명 형식인지 확인
      if (decodedKey.includes('AKIA')) {
        // AWS Access Key 형식
        const parts = decodedKey.split(':');
        const accessKeyId = parts[0];
        const secretAccessKey = parts[1];

        console.log('Access Key ID:', accessKeyId);
        console.log('Secret Key length:', secretAccessKey?.length);

        this.bedrock = new BedrockRuntimeClient({
          region: 'ap-northeast-2',
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
      } else {
        // 다른 형식일 수 있음 - 기본 AWS 자격 증명 사용
        console.log('Using default AWS credentials instead');
        this.bedrock = new BedrockRuntimeClient({
          region: 'ap-northeast-2',
        });
      }
    } catch (error) {
      const bedrockError = error as BedrockError;
      console.error('Failed to process Bedrock API key:', bedrockError.message);
      // 기본 AWS 자격 증명으로 폴백
      console.log('Falling back to default AWS credentials');
      this.bedrock = new BedrockRuntimeClient({
        region: 'ap-northeast-2',
      });
    }

    console.log('🚀 AnalysisService initialized with Tree-sitter caching');
  }

  async getRealtimeAnalysis(
    problemId: string,
    studentCode: string,
  ): Promise<RealtimeAnalysisResponseDto> {
    const startTime = Date.now();
    this.logger.log(`🚀 Starting analysis for problemId: ${problemId}`);
    console.log(`🚀 Starting analysis for problemId: ${problemId}`);

    // DB에서 문제 설명 가져오기
    const dbStart = Date.now();
    const problem = await this.problemRepository.findOne({
      where: { problemId: parseInt(problemId) },
    });
    const dbEnd = Date.now();
    this.logger.log(`📊 DB Query took: ${dbEnd - dbStart}ms`);
    console.log(`📊 DB Query took: ${dbEnd - dbStart}ms`);

    if (!problem) {
      throw new NotFoundException(`Problem with ID ${problemId} not found`);
    }

    const problemDescription = problem.description;

    // 캐시 조회
    const cached = await this.cacheService.getCachedAnalysis(
      problemId,
      studentCode,
    );
    if (cached) {
      const totalTime = Date.now() - startTime;
      this.logger.log(`✅ Cache HIT - Total time: ${totalTime}ms`);
      return cached;
    }

    this.logger.log(`❌ Cache MISS - proceeding to AI call`);

    // Amazon Bedrock Nova Micro 호출
    const systemPrompt = `학생 코드를 분석하여 JSON으로 응답하세요.

분석 항목:
1. 학생의 접근 방식 파악
2. 좋은점과 개선점 제시
3. 간단한 피드백 제공
4. 각 항목은 50자 이하로 작성한다
5. 모든 문장은 "~니다"으로 끝나야 함.

출력 형식 (JSON만):
{
  "realtime_hints": ["좋은점", "개선점"],
  "analysis": {"approach": "접근방식 분석"},
  "recommendation": "종합 피드백"
}`;

    const userMessage = `# 문제 설명
${problemDescription}

# 학생이 작성한 코드
\`\`\`python
${studentCode}
\`\`\``;

    this.logger.log(`🤖 Calling Amazon Bedrock Nova Micro...`);
    this.logger.log(`📤 Sending to Bedrock:`);
    this.logger.log(`   - Problem ID: ${problemId}`);
    this.logger.log(
      `   - Problem: ${problemDescription.substring(0, 100)}${problemDescription.length > 100 ? '...' : ''}`,
    );
    this.logger.log(
      `   - Student Code: ${studentCode.substring(0, 100)}${studentCode.length > 100 ? '...' : ''}`,
    );

    const aiStart = Date.now();
    const command = new InvokeModelCommand({
      modelId: 'apac.amazon.nova-lite-v1:0',
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: [
              {
                text: `${systemPrompt}\n\n${userMessage}`,
              },
            ],
          },
        ],
        inferenceConfig: {
          temperature: 0.1,
          topP: 0.9,
          maxTokens: 200,
        },
      }),
      contentType: 'application/json',
      accept: 'application/json',
    });

    const response = await this.bedrock.send(command);
    const aiEnd = Date.now();
    this.logger.log(`🧠 Bedrock Nova Micro took: ${aiEnd - aiStart}ms`);
    console.log(`🧠 Bedrock Nova Micro took: ${aiEnd - aiStart}ms`);

    if (!response.body) {
      throw new Error('Bedrock returned empty response');
    }

    const responseBody = JSON.parse(
      new TextDecoder().decode(response.body),
    ) as BedrockResponseBody;
    console.log(
      'Bedrock response body:',
      JSON.stringify(responseBody, null, 2),
    );

    // Nova Micro 응답 구조 확인
    let aiText = '';
    if (
      responseBody.output &&
      responseBody.output.message &&
      responseBody.output.message.content &&
      responseBody.output.message.content[0]?.text
    ) {
      aiText = responseBody.output.message.content[0].text;
    } else if (responseBody.content && responseBody.content[0]?.text) {
      aiText = responseBody.content[0].text;
    } else {
      console.error('Unknown response structure:', responseBody);
      throw new Error('Unable to parse Bedrock response structure');
    }

    console.log('AI response text:', aiText);

    // 마크다운 코드 블록 제거
    let cleanedText = aiText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    console.log('Cleaned AI text for parsing:', cleanedText);

    // JSON 파싱 시도
    let analysisResult: RealtimeAnalysisResponseDto;
    try {
      analysisResult = JSON.parse(cleanedText) as RealtimeAnalysisResponseDto;
    } catch (parseError) {
      const parseErr = parseError as Error;
      console.error('JSON parse error:', parseErr.message);
      console.error('Raw AI text:', aiText);
      throw new Error(
        `Failed to parse AI response as JSON: ${parseErr.message}`,
      );
    }

    // 캐시에 저장
    await this.cacheService.saveCachedAnalysis(
      problemId,
      studentCode,
      analysisResult,
    );

    const totalTime = Date.now() - startTime;
    this.logger.log(`🏁 Total Analysis Time: ${totalTime}ms`);
    console.log(`🏁 Total Analysis Time: ${totalTime}ms`);

    return analysisResult;
  }

  async getDetailedAnalysis(
    problemId: string,
    studentCode: string,
    staticAnalysisResult: string,
  ): Promise<DetailedAnalysisResponseDto> {
    const startTime = Date.now();
    this.logger.log(
      `🚀 Starting detailed analysis for problemId: ${problemId}`,
    );
    console.log(`🚀 Starting detailed analysis for problemId: ${problemId}`);

    // DB에서 문제 설명 가져오기
    const dbStart = Date.now();
    const problem = await this.problemRepository.findOne({
      where: { problemId: parseInt(problemId) },
    });
    const dbEnd = Date.now();
    this.logger.log(`📊 DB Query took: ${dbEnd - dbStart}ms`);
    console.log(`📊 DB Query took: ${dbEnd - dbStart}ms`);

    if (!problem) {
      throw new NotFoundException(`Problem with ID ${problemId} not found`);
    }

    const problemDescription = problem.description;

    // 상세 분석용 프롬프트
    const detailedSystemPrompt = `# [역할]
너는 세계 최고의 알고리즘 강사이자 친절한 코드 리뷰어 AI다. 너의 임무는 선생님이 학생의 코드를 빠르게 이해하고, 학생의 문제 해결 전략을 깊이 있게 분석하여 건설적인 피드백을 제공하는 것이다.

# [지시사항]
아래 [컨텍스트]에 제공된 정보를 바탕으로 다음 항목들을 분석하고, 반드시 [출력 형식]에 정의된 JSON 구조에 맞춰 응답해야 한다.

1.  **사고 과정 분석**: 코드와 복잡도를 보고 학생의 접근 전략을 추론한다.
2.  **전략 평가**: 추론된 전략의 긍정적인 부분과 아쉬운 부분을 평가한다.
3.  **개선점 제공**: 코드의 효율성을 높일 수 있는 핵심 아이디어를 제공한다.
4.  **종합 피드백**: 위 내용을 종합하여 학습 방향을 추천한다.
5.  **제약 조건 준수**: 각 값은 간결한 단답형 문장(~다)으로, 50자 이내로 작성한다. 단, \`recommendation\`은 150자 이상 250자 이내로 작성한다.

# [출력 형식]
모든 응답은 반드시 다음 키(key)를 가진 JSON 형식이어야 한다.

{
  "analysis": {
    "approach": "학생의 접근 방식 분석 내용",
    "pros": "접근 방식의 긍정적인 점",
    "cons": "접근 방식의 아쉬운 점"
  },
  "recommendation": "종합적인 격려와 알고리즘 개선을 위한 핵심 아이디어, 다음 학습 방향 추천"
}`;

    const userMessage = `# 문제 설명
${problemDescription}

# 학생이 작성한 코드
\`\`\`python
${studentCode}
\`\`\`

# 정적 분석 결과
${staticAnalysisResult}`;

    this.logger.log(
      `🤖 Calling Amazon Bedrock Claude Sonnet 4 for detailed analysis...`,
    );
    this.logger.log(`📤 Sending to Bedrock:`);
    this.logger.log(`   - Problem ID: ${problemId}`);
    this.logger.log(
      `   - Problem: ${problemDescription.substring(0, 100)}${problemDescription.length > 100 ? '...' : ''}`,
    );
    this.logger.log(
      `   - Student Code: ${studentCode.substring(0, 100)}${studentCode.length > 100 ? '...' : ''}`,
    );
    this.logger.log(`   - Static Analysis: ${staticAnalysisResult}`);

    const aiStart = Date.now();
    const command = new InvokeModelCommand({
      modelId: 'apac.anthropic.claude-sonnet-4-20250514-v1:0',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `${detailedSystemPrompt}\n\n${userMessage}`,
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
      contentType: 'application/json',
      accept: 'application/json',
    });

    const response = await this.bedrock.send(command);
    const aiEnd = Date.now();
    this.logger.log(`🧠 Claude Sonnet 4 took: ${aiEnd - aiStart}ms`);
    console.log(`🧠 Claude Sonnet 4 took: ${aiEnd - aiStart}ms`);

    if (!response.body) {
      throw new Error('Bedrock returned empty response');
    }

    const responseBody = JSON.parse(
      new TextDecoder().decode(response.body),
    ) as BedrockResponseBody;
    console.log(
      'Bedrock detailed response body:',
      JSON.stringify(responseBody, null, 2),
    );

    // Nova Micro 응답 구조 확인
    let aiText = '';
    if (
      responseBody.output &&
      responseBody.output.message &&
      responseBody.output.message.content &&
      responseBody.output.message.content[0]?.text
    ) {
      aiText = responseBody.output.message.content[0].text;
    } else if (responseBody.content && responseBody.content[0]?.text) {
      aiText = responseBody.content[0].text;
    } else {
      console.error('Unknown response structure:', responseBody);
      throw new Error('Unable to parse Bedrock response structure');
    }

    console.log('AI detailed response text:', aiText);

    // 마크다운 코드 블록 제거
    let cleanedText = aiText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    console.log('Cleaned AI text for parsing:', cleanedText);

    // JSON 파싱 시도
    let analysisResult: DetailedAnalysisResponseDto;
    try {
      analysisResult = JSON.parse(cleanedText) as DetailedAnalysisResponseDto;
    } catch (parseError) {
      const parseErr = parseError as Error;
      console.error('JSON parse error:', parseErr.message);
      console.error('Raw AI text:', aiText);
      throw new Error(
        `Failed to parse AI response as JSON: ${parseErr.message}`,
      );
    }

    // 상세 분석은 캐시하지 않음 (항상 최고 품질)
    const totalTime = Date.now() - startTime;
    this.logger.log(`🏁 Total Detailed Analysis Time: ${totalTime}ms`);
    console.log(`🏁 Total Detailed Analysis Time: ${totalTime}ms`);

    return analysisResult;
  }
}
