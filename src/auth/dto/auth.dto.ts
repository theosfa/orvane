// auth/dto/auth.dto.ts
import { IsEmail, IsIn, IsOptional, MinLength } from 'class-validator';
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

export class UpdateProfileDto {
  @IsIn(SUPPORTED_LANGUAGES)
  language: string;
}
