// menu/dto/add-menu-entry.dto.ts
import { IsInt, IsIn, Min, Max } from 'class-validator';
import { MEAL_TYPES } from '../menu-entry.entity';
import type { MealType } from '../menu-entry.entity';

export class AddMenuEntryDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsIn(MEAL_TYPES)
  mealType: MealType;

  @IsInt()
  recipeId: number;
}
