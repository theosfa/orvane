// ai/dto/generate-recipe.dto.ts
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SUPPORTED_LANGUAGES } from '../../common/languages';

export class GenerateRecipeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  prompt: string;

  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES)
  lang?: string;
}
