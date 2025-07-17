import {
  Controller,
  Post,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { OpenviduService } from './openvidu.service';

interface OpenViduSession {
  id: string;
  sessionId: string;
  createdAt: number;
  recording: boolean;
  broadcasting: boolean;
  mediaMode: string;
  recordingMode: string;
  customSessionId?: string;
}

interface OpenViduConnection {
  id: string;
  connectionId: string;
  sessionId: string;
  createdAt: number;
  token: string;
  role: string;
  status: string;
}

@Controller('api/v1/openvidu')
export class OpenviduController {
  private readonly logger = new Logger(OpenviduController.name);

  constructor(private readonly openviduService: OpenviduService) {}

  // 세션 생성
  @Post('sessions')
  async createSession(
    @Body() body: { customSessionId?: string },
  ): Promise<{ sessionId: string }> {
    try {
      this.logger.log('세션 생성 요청:', body);
      const session: OpenViduSession = await this.openviduService.createSession(
        body.customSessionId,
      );
      this.logger.log('세션 생성 성공:', session);
      return { sessionId: session.id || session.sessionId };
    } catch (err) {
      this.logger.error('OpenVidu Session Error:', err);
      throw new HttpException(
        err instanceof Error ? err.message : JSON.stringify(err),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 세션에 참가할 토큰 발급
  @Post('sessions/:sessionId/connections')
  async createConnection(
    @Param('sessionId') sessionId: string,
    @Body() body: { role?: string },
  ): Promise<{ token: string }> {
    try {
      this.logger.log('연결 생성 요청:', { sessionId, body });
      const connection: OpenViduConnection =
        await this.openviduService.createConnection(
          sessionId,
          body.role || 'PUBLISHER',
        );
      this.logger.log('연결 생성 성공:', connection);
      return { token: connection.token };
    } catch (err) {
      this.logger.error('Connection creation failed:', err);
      throw new HttpException(
        err instanceof Error ? err.message : 'Connection creation failed',
        HttpStatus.NOT_FOUND,
      );
    }
  }
}
