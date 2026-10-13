// finance/dto/transaction.dto.ts
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TRANSACTION_TYPES } from '../finance-types';
import { DATE_RE } from '../../common/dates';
import type { TransactionType } from '../finance-types';


const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateTransactionDto {
  @IsIn(TRANSACTION_TYPES)
  type: TransactionType;

  @IsInt()
  walletId: number;

  // null / не передан — без категории
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  categoryId?: number | null;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000_000)
  amount: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  note?: string;

  @Matches(DATE_RE, { message: 'date must be YYYY-MM-DD' })
  date: string;

  // финансовый итог задачи из Планов: вместе с записью задача отмечается выполненной
  @IsOptional()
  @IsInt()
  taskId?: number;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsIn(TRANSACTION_TYPES)
  type?: TransactionType;

  @IsOptional()
  @IsInt()
  walletId?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  categoryId?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000_000)
  amount?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  note?: string;

  @IsOptional()
  @Matches(DATE_RE, { message: 'date must be YYYY-MM-DD' })
  date?: string;
}

// GET /finance/transactions и /finance/summary — все поля из query-строки
export class TransactionFiltersDto {
  @IsOptional()
  @IsIn(TRANSACTION_TYPES)
  type?: TransactionType;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  walletId?: number;

  // 'none' — операции без категории
  @IsOptional()
  @Transform(({ value }) => (value === 'none' ? 'none' : Number(value)))
  @ValidateIf((_, v) => v !== 'none')
  @IsInt()
  categoryId?: number | 'none';

  @IsOptional()
  @Matches(DATE_RE, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @Matches(DATE_RE, { message: 'to must be YYYY-MM-DD' })
  to?: string;
}
