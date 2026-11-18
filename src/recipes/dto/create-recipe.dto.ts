// recipes/dto/create-recipe.dto.ts
import {
  IsString,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  IsBoolean,
  IsOptional,
  Max,
  IsUUID,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_SERVINGS } from '../servings';
import { MAX_PHOTOS_PER_RECIPE } from '../../photos/photos.service';

class RecipeIngredientDto {
  @IsInt()
  ingredientId: number;

  @Min(0.1)
  amount: number;
}

class RecipeStepDto {
  @IsInt()
  stepNum: number;

  @IsString()
  stepText: string;
}

export class CreateRecipeDto {
  @IsString()
  name: string;

  // на сколько человек рассчитан рецепт (по умолчанию 1)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SERVINGS)
  servings?: number;

  // по умолчанию рецепт публичный
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients: RecipeIngredientDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeStepDto)
  steps: RecipeStepDto[];

  // фото, загруженные заранее (POST /photos или генерация ИИ); первое — главное
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PHOTOS_PER_RECIPE)
  @IsUUID('4', { each: true })
  photoIds?: string[];
}

// POST /recipes/:id/photos — добавить уже загруженные фото к своему рецепту
export class AttachPhotosDto {
  @IsArray()
  @ArrayMaxSize(MAX_PHOTOS_PER_RECIPE)
  @IsUUID('4', { each: true })
  photoIds: string[];
}
