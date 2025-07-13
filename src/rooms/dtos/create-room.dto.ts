import { IsString, IsNumber, IsNotEmpty, Min, Max } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(1, { message: '최소 학생 1명 이상이어야 합니다.' })
  @Max(4, { message: '최대 학생 4명까지 가능합니다.' })
  maxParticipants: number;
}
