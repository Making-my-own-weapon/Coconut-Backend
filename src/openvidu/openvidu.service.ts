import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosError } from 'axios';
import * as https from 'https';

interface OpenViduSession {
  id: string;
  sessionId: string;
  createdAt: number;
  recording: boolean;
  broadcasting: boolean;
  mediaMode: string;
  recordingMode: string;
  customSessionId?: string;
  connections?: {
    numberOfElements: number;
    content: any[];
  };
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

@Injectable()
export class OpenviduService {
  private readonly axiosInstance: AxiosInstance;
  private readonly logger = new Logger(OpenviduService.name);

  constructor() {
    const url = this.getEnv('OPENVIDU_URL');
    const secret = this.getEnv('OPENVIDU_SECRET');

    this.axiosInstance = axios.create({
      baseURL: url,
      auth: {
        username: 'OPENVIDUAPP',
        password: secret,
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false, // self-signed 인증서 허용
      }),
    });

    // 요청/응답 인터셉터 추가
    this.axiosInstance.interceptors.request.use(
      (config) => {
        this.logger.log(
          `OpenVidu API 요청: ${config.method?.toUpperCase()} ${config.url}`,
        );
        return config;
      },
      (error: AxiosError) => {
        this.logger.error('OpenVidu API 요청 에러:', error);
        return Promise.reject(new Error(error.message));
      },
    );

    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.logger.log(
          `OpenVidu API 응답: ${response.status} ${response.config.url}`,
        );
        return response;
      },
      (error: AxiosError) => {
        this.logger.error('OpenVidu API 응답 에러:', {
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url,
        });
        return Promise.reject(new Error(error.message));
      },
    );
  }

  private getEnv(key: string): string {
    const val = process.env[key];
    if (!val) {
      throw new Error(`Required env var ${key} is not defined.`);
    }
    return val;
  }

  /** 세션 생성 또는 기존 세션 조회 */
  async createSession(customSessionId?: string): Promise<OpenViduSession> {
    try {
      // 먼저 기존 세션이 있는지 확인
      if (customSessionId) {
        try {
          const sessionsResponse = await this.axiosInstance.get<{
            numberOfElements: number;
            content: OpenViduSession[];
          }>('/openvidu/api/sessions');
          const existingSession = sessionsResponse.data.content.find(
            (session) => session.customSessionId === customSessionId,
          );
          if (existingSession) {
            this.logger.log('기존 세션을 찾았습니다:', existingSession.id);
            return existingSession;
          }
        } catch (error) {
          this.logger.warn(
            '기존 세션 조회 중 에러 (무시하고 새로 생성):',
            error,
          );
        }
      }

      // 기존 세션이 없으면 새로 생성
      this.logger.log('새 세션을 생성합니다:', customSessionId);
      const response = await this.axiosInstance.post<OpenViduSession>(
        '/openvidu/api/sessions',
        {
          customSessionId,
        },
      );
      return response.data;
    } catch (error) {
      this.logger.error('세션 생성 실패:', error);
      throw error;
    }
  }

  /** 토큰 발급 */
  async createConnection(
    sessionId: string,
    role: string = 'PUBLISHER',
  ): Promise<OpenViduConnection> {
    try {
      const response = await this.axiosInstance.post<OpenViduConnection>(
        `/openvidu/api/sessions/${sessionId}/connection`,
        {
          role,
        },
      );
      return response.data;
    } catch (error) {
      this.logger.error('연결 생성 실패:', error);
      throw error;
    }
  }

  /** 세션 목록 조회 */
  async getSessions(): Promise<{
    numberOfElements: number;
    content: OpenViduSession[];
  }> {
    try {
      const response = await this.axiosInstance.get<{
        numberOfElements: number;
        content: OpenViduSession[];
      }>('/openvidu/api/sessions');
      return response.data;
    } catch (error) {
      this.logger.error('세션 목록 조회 실패:', error);
      throw error;
    }
  }
}
