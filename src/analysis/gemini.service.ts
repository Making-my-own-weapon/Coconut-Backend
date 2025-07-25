import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { RealtimeAnalysisResponseDto } from './dto/realtime-analysis.dto';
import { DetailedAnalysisResponseDto } from './dto/detailed-analysis.dto';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      this.logger.error('GEMINI_API_KEY not found in environment variables');
      throw new Error('GEMINI_API_KEY not found in environment variables');
    }

    this.genAI = new GoogleGenAI({
      apiKey,
    });
    this.logger.log('🚀 GeminiService initialized');
  }

  async callGeminiRealtime(
    problemId: string,
    studentCode: string,
    problemDescription: string,
  ): Promise<RealtimeAnalysisResponseDto> {
    const startTime = Date.now();
    this.logger.log(`🤖 Calling Gemini for realtime analysis...`);

    try {
      const config = {
        temperature: 0.1,
        maxOutputTokens: 500,
      };

      const systemPrompt = `학생 코드를 분석하여 JSON으로 응답하세요.

분석 항목:
1. 학생의 접근 방식 파악
2. 좋은점과 개선점 제시
3. 간단한 피드백 제공
4. 각 항목은 50자 이하로 작성한다
5. 모든 문장은 "~니다"으로 끝나야 함.
6. 변수명, 주석은 무시하고, 로직만 판단.

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

      const prompt = `${systemPrompt}\n\n${userMessage}`;

      const contents = [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ];

      const response = await this.genAI.models.generateContentStream({
        model: 'gemini-2.5-flash-lite',
        config,
        contents,
      });

      let fullText = '';
      for await (const chunk of response) {
        fullText += chunk.text;
      }

      this.logger.log(`🧠 Gemini realtime took: ${Date.now() - startTime}ms`);

      return this.parseGeminiResponse(fullText) as RealtimeAnalysisResponseDto;
    } catch (error) {
      this.logger.error(
        `Gemini realtime call failed: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async callGeminiDetailed(
    problemId: string,
    studentCode: string,
    problemDescription: string,
    staticAnalysisResult: string,
  ): Promise<DetailedAnalysisResponseDto> {
    const startTime = Date.now();
    this.logger.log(`🤖 Calling Gemini for detailed analysis...`);

    try {
      const config = {
        temperature: 0.1,
        maxOutputTokens: 2000,
      };

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

      const prompt = `${detailedSystemPrompt}\n\n${userMessage}`;

      const contents = [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ];

      const response = await this.genAI.models.generateContentStream({
        model: 'gemini-2.5-flash-lite',
        config,
        contents,
      });

      let fullText = '';
      for await (const chunk of response) {
        fullText += chunk.text;
      }

      this.logger.log(`🧠 Gemini detailed took: ${Date.now() - startTime}ms`);

      return this.parseGeminiResponse(fullText) as DetailedAnalysisResponseDto;
    } catch (error) {
      this.logger.error(
        `Gemini detailed call failed: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private parseGeminiResponse(text: string): any {
    // 마크다운 코드 블록 제거
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    this.logger.log('Cleaned Gemini text for parsing:', cleanedText);

    // JSON 파싱 시도
    try {
      return JSON.parse(cleanedText);
    } catch (parseError) {
      this.logger.error('JSON parse error:', parseError);
      this.logger.error('Raw Gemini text:', text);
      throw new Error(
        `Failed to parse Gemini response as JSON: ${(parseError as Error).message}`,
      );
    }
  }
}
