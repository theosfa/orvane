// auth/dto/auth.dto.ts
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { USERNAME_RE } from '../../users/username';
import { SUPPORTED_LANGUAGES } from '../../common/languages';

export class AuthDto {
  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;

  // при регистрации — язык, на котором юзер сейчас видит сайт
  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES)
  language?: string;
}

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// PATCH /auth/profile — любые из полей
export class UpdateProfileDto {
  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES)
  language?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @Matches(USERNAME_RE, {
    message: 'username: 3–30 characters, a–z, 0–9, _ and .',
  })
  username?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @IsOptional()
  @IsBoolean()
  showFullName?: boolean;
}
