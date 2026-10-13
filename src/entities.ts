// entities.ts — единый список сущностей для приложения, CLI миграций и тестов
import { User } from './users/users.entity';
import { Ingredient } from './ingredients/ingredient.entity';
import { IngredientTranslation } from './ingredients/ingredient-translation.entity';
import { Recipe } from './recipes/recipe.entity';
import { RecipeIngredient } from './recipes/recipe-ingredient.entity';
import { RecipeStep } from './recipes/recipe-step.entity';
import { RecipeTranslation } from './recipes/recipe-translation.entity';
import { RecipeStepTranslation } from './recipes/recipe-step-translation.entity';
import { RecipeLike } from './recipes/recipe-like.entity';
import { MenuEntry } from './menu/menu-entry.entity';
import { RefreshToken } from './auth/refresh-token.entity';
import { Wallet } from './finance/wallet.entity';
import { FinanceCategory } from './finance/finance-category.entity';
import { FinanceTransaction } from './finance/finance-transaction.entity';

export const ENTITIES = [
  User,
  Ingredient,
  IngredientTranslation,
  Recipe,
  RecipeIngredient,
  RecipeStep,
  RecipeTranslation,
  RecipeStepTranslation,
  RecipeLike,
  MenuEntry,
  RefreshToken,
  Wallet,
  FinanceCategory,
  FinanceTransaction,
];
