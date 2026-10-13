// recipes/recipe.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { User } from '../users/users.entity';
import { RecipeIngredient } from './recipe-ingredient.entity';
import { RecipeStep } from './recipe-step.entity';
import { RecipeTranslation } from './recipe-translation.entity';

@Entity('recipes')
export class Recipe {
  @PrimaryGeneratedColumn()
  id: number;

  // название на языке оригинала (originalLanguage); переводы — в translations
  @Column()
  name: string;

  // язык, на котором автор написал рецепт ('ru' | 'en' | 'pl' | 'fr' | 'uk')
  @Column({ length: 5, default: 'en' })
  originalLanguage: string;

  @OneToMany(() => RecipeTranslation, (t) => t.recipe)
  translations: RecipeTranslation[];

  // автор рецепта; null — у старых рецептов, созданных до появления авторства
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  author: User | null;

  @Column({ type: 'int', nullable: true })
  authorId: number | null;

  // на сколько человек рассчитаны количества ингредиентов
  @Column({ type: 'smallint', default: 1 })
  servings: number;

  // приватный рецепт видит только автор
  @Column({ default: true })
  isPublic: boolean;

  @OneToMany(() => RecipeIngredient, (ri) => ri.recipe, { cascade: true })
  ingredients: RecipeIngredient[];

  @OneToMany(() => RecipeStep, (s) => s.recipe, { cascade: true })
  steps: RecipeStep[];
}
