// recipes/dto/create-recipe.dto.ts
import {
  IsString,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

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
