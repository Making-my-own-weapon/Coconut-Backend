import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class S3Service {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-northeast-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  /**
   * S3에 파일 업로드
   * @param content 파일 내용
   * @param key S3 키 (파일 경로)
   * @returns 업로드된 파일의 URL
   */
  async uploadFile(content: string, key: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: content,
      ContentType: 'text/plain',
    });

    try {
      await this.s3Client.send(command);
      return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'ap-northeast-2'}.amazonaws.com/${key}`;
    } catch (error) {
      console.error('S3 업로드 실패:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`S3 업로드 실패: ${errorMessage}`);
    }
  }

  /**
   * S3에서 파일 다운로드
   * @param key S3 키 (파일 경로)
   * @returns 파일 내용
   */
  async downloadFile(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    });

    try {
      const result = await this.s3Client.send(command);
      const bodyContents = await result.Body?.transformToString();
      return bodyContents || '';
    } catch (error) {
      console.error('S3 다운로드 실패:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`S3 다운로드 실패: ${errorMessage}`);
    }
  }

  /**
   * S3에서 파일 삭제
   * @param key S3 키 (파일 경로)
   */
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    });

    try {
      await this.s3Client.send(command);
    } catch (error) {
      console.error('S3 삭제 실패:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`S3 삭제 실패: ${errorMessage}`);
    }
  }

  /**
   * 문제 폴더의 모든 테스트케이스 파일 삭제
   * @param problemId 문제 ID
   */
  async deleteProblemFiles(problemId: number): Promise<void> {
    const folderKey = `problems/${problemId}/`;

    try {
      // 폴더 내 모든 파일 목록 조회
      const listCommand = new ListObjectsV2Command({
        Bucket: process.env.AWS_S3_BUCKET,
        Prefix: folderKey,
      });

      const objects = await this.s3Client.send(listCommand);

      if (objects.Contents && objects.Contents.length > 0) {
        // 모든 파일 삭제
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Delete: {
            Objects: objects.Contents.map((obj) => ({ Key: obj.Key })),
          },
        });

        await this.s3Client.send(deleteCommand);
      }
    } catch (error) {
      console.error('문제 파일 삭제 실패:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`문제 파일 삭제 실패: ${errorMessage}`);
    }
  }
}
