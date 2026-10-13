// tasks/dto/task.dto.ts
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { DATE_RE } from '../../common/dates';
import { TASK_SOURCES } from '../task.entity';
import type { TaskSource } from '../task.entity';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateTaskDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string;

  @Matches(DATE_RE, { message: 'date must be YYYY-MM-DD' })
  date: string;

  // другие приложения помечают свои задачи: 'food', 'finance'
  @IsOptional()
  @IsIn(TASK_SOURCES)
  source?: TaskSource;
}
