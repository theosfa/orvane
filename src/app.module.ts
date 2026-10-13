import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { User } from './users/users.entity';
import * as dotenv from 'dotenv';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IngredientsModule } from './ingredients/ingredients.module';
import { Ingredient } from './ingredients/ingredient.entity';
import { IngredientTranslation } from './ingredients/ingredient-translation.entity';
import { RecipesModule } from './recipes/recipes.module';
import { Recipe } from './recipes/recipe.entity';
import { RecipeIngredient } from './recipes/recipe-ingredient.entity';
import { RecipeStep } from './recipes/recipe-step.entity';
import { RecipeTranslation } from './recipes/recipe-translation.entity';
import { RecipeStepTranslation } from './recipes/recipe-step-translation.entity';
import { RecipeLike } from './recipes/recipe-like.entity';
import { MenuModule } from './menu/menu.module';
import { MenuEntry } from './menu/menu-entry.entity';
import { RefreshToken } from './auth/refresh-token.entity';
import { AiModule } from './ai/ai.module';

dotenv.config();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: process.env.DATABASE_TYPE as 'postgres',
        host: process.env.DATABASE_HOST,
        port: parseInt(process.env.DATABASE_PORT || '5432', 10) as number, // Use type assertion
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
        synchronize: false,
      }),
    }),
    AuthModule,
    UsersModule,
    IngredientsModule,
    RecipesModule,
    MenuModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
