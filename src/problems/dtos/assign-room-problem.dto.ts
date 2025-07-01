import { IsInt } from 'class-validator';

export class AssignRoomProblemDto {
  @IsInt() problemId: number;
}
