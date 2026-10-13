// finance/dto/wallet.dto.ts
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateWalletDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  // начальный баланс может быть и отрицательным (например, кредитка)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-1_000_000_000)
  @Max(1_000_000_000)
  initialBalance?: number;
}

export class UpdateWalletDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-1_000_000_000)
  @Max(1_000_000_000)
  initialBalance?: number;
}
