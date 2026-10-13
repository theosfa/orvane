// recipes/recipe-step.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Recipe } from './recipe.entity';
import { RecipeStepTranslation } from './recipe-step-translation.entity';

@Entity('recipe_steps')
export class RecipeStep {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Recipe, (r) => r.steps, { onDelete: 'CASCADE' })
  recipe: Recipe;

  @Column()
  stepNum: number;

  // текст на языке оригинала рецепта; переводы — в translations
  @Column('text')
  stepText: string;

  @OneToMany(() => RecipeStepTranslation, (t) => t.step)
  translations: RecipeStepTranslation[];
}
