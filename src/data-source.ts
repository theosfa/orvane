import { DataSource } from 'typeorm';
import { config } from 'dotenv';
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

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [
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
  ],
  migrations: ['src/migrations/*.ts'],
  synchronize: false, // migrations replace synchronize
});