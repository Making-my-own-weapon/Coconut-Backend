import {
  IsOptional,
  IsString,
  IsInt,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class SampleTestcase {
  @IsString() input: string;
  @IsString() output: string;
}

export class UpdateProblemDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() timeLimitMs?: number;
  @IsOptional() @IsInt() memoryLimitKb?: number;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SampleTestcase)
  sampleTestcases?: SampleTestcase[];
}
