// ingredients/ingredients.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ingredient } from './ingredient.entity';
import { IngredientTranslation } from './ingredient-translation.entity';
import { IngredientsService } from './ingredients.service';
import { IngredientsController } from './ingredients.controller';
import { TranslationModule } from '../translation/translation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ingredient, IngredientTranslation]),
    TranslationModule,
  ],
  providers: [IngredientsService],
  controllers: [IngredientsController],
  exports: [IngredientsService],
})
export class IngredientsModule {}
