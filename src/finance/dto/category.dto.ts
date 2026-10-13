// finance/dto/category.dto.ts
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { TRANSACTION_TYPES } from '../finance-types';
import type { TransactionType } from '../finance-types';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCategoryDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @IsIn(TRANSACTION_TYPES)
  type: TransactionType;
}

export class RenameCategoryDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;
}
