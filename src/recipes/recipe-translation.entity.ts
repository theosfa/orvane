// recipes/recipe-translation.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { Recipe } from './recipe.entity';

// название рецепта на другом языке; оригинал лежит в recipes.name (язык — recipes.originalLanguage)
@Entity('recipe_translations')
@Index('IDX_recipe_translations_recipe_language', ['recipeId', 'language'], {
  unique: true,
})
export class RecipeTranslation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Recipe, (r) => r.translations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipeId' })
  recipe: Recipe;

  @Column()
  recipeId: number;

  @Column({ length: 5 })
  language: string;

  @Column()
  name: string;

  // true — перевёл DeepL; false — человек (автор поправил перевод)
  @Column({ default: true })
  isMachine: boolean;
}
