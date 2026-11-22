import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { SUPPORTED_LANGUAGES } from '../../common/languages';

// POST /ai/recipes/from-photo (multipart): поле file + эти текстовые поля
export class FromPhotoDto {
  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES)
  lang?: string;

  // необязательное уточнение: "это бабушкин рецепт", "сделай на 2 порции"
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
