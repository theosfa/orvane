// recipes/recipes.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Recipe } from './recipe.entity';
import { RecipeIngredient } from './recipe-ingredient.entity';
import { RecipeStep } from './recipe-step.entity';
import { RecipeLike } from './recipe-like.entity';
import { RecipesService } from './recipes.service';
import { RecipesController } from './recipes.controller';
import { Ingredient } from '../ingredients/ingredient.entity';
import { RecipeTranslation } from './recipe-translation.entity';
import { RecipeStepTranslation } from './recipe-step-translation.entity';
import { RecipeLocalizer } from './recipe-localizer.service';
import { TranslationModule } from '../translation/translation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Recipe,
      RecipeIngredient,
      RecipeStep,
      Ingredient,
      RecipeLike,
      RecipeTranslation,
      RecipeStepTranslation,
    ]),
    TranslationModule,
  ],
  providers: [RecipesService, RecipeLocalizer],
  controllers: [RecipesController],
  exports: [RecipesService, RecipeLocalizer],
})
export class RecipesModule {}
