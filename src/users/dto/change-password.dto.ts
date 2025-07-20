import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(8, { message: '현재 비밀번호는 최소 8자 이상이어야 합니다.' })
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: '새 비밀번호는 최소 8자 이상이어야 합니다.' })
  newPassword: string;
}
