// menu/dto/add-menu-entry.dto.ts
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DATE_RE } from '../../common/dates';
import { MAX_MENU_SERVINGS, MEAL_TYPES } from '../menu-entry.entity';
import type { MealType } from '../menu-entry.entity';

export class MenuMealDto {
  @IsIn(MEAL_TYPES)
  mealType: MealType;

  @IsInt()
  recipeId: number;

  @IsInt()
  @Min(1)
  @Max(MAX_MENU_SERVINGS)
  servings: number;
}

export class AddMenuEntryDto extends MenuMealDto {
  @Matches(DATE_RE, { message: 'date must be YYYY-MM-DD' })
  date: string;
}

// PUT /menu/days/:date — весь день целиком
export class SetMenuDayDto {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => MenuMealDto)
  meals: MenuMealDto[];
}
