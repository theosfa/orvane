// recipes/recipe-ingredient.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Recipe } from './recipe.entity';
import { Ingredient } from '../ingredients/ingredient.entity';

@Entity('recipe_ingredients')
export class RecipeIngredient {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Recipe, (r) => r.ingredients, { onDelete: 'CASCADE' })
  recipe: Recipe;

  @ManyToOne(() => Ingredient, { onDelete: 'RESTRICT' })
  ingredient: Ingredient;

  @Column('decimal', { precision: 8, scale: 2 })
  amount: number; // граммы
}
