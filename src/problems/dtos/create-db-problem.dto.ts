import { IsString, IsInt, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SampleTestcase {
  @IsString() input: string;
  @IsString() output: string;
}

export class CreateDbProblemDto {
  @IsString() title: string;
  @IsInt() timeLimitMs: number;
  @IsInt() memoryLimitKb: number;
  @IsString() description: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SampleTestcase)
  sampleTestcases: SampleTestcase[];
}
