import { IsArray, IsInt, ArrayNotEmpty } from 'class-validator';

export class AssignRoomProblemDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  problemIds: number[];
}
