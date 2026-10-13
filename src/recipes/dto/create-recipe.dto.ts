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
} from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_SERVINGS } from '../servings';

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
}
