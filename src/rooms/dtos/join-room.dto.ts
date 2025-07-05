import { IsString, IsNotEmpty } from 'class-validator';

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty()
  inviteCode: string;

  @IsString()
  @IsNotEmpty()
  userName: string;
}
