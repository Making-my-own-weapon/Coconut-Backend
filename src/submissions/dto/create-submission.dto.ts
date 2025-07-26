import { IsNotEmpty, IsString, IsNumberString } from 'class-validator';

export class CreateSubmissionDto {
  @IsNumberString()
  @IsNotEmpty()
  pid: string; // 프론트엔드와 호환 (BIGINT는 string으로 받음)

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  language: string;
}
