// ingredients/dto/create-ingredient.dto.ts
import { IsString, MinLength, IsNumber, Min } from 'class-validator';

export class CreateIngredientDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsNumber()
  @Min(0)
  caloriesPer100g: number;

  @IsNumber()
  @Min(0)
  proteinPer100g: number;

  @IsNumber()
  @Min(0)
  fatPer100g: number;

  @IsNumber()
  @Min(0)
  carbsPer100g: number;
}
