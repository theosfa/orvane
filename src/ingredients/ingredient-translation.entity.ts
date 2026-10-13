// ingredients/ingredient-translation.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
} from 'typeorm';
import { Ingredient } from './ingredient.entity';

@Entity('ingredient_translations')
@Index(['ingredient', 'language'], { unique: true }) // один перевод на язык на ингредиент
export class IngredientTranslation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Ingredient, (i) => i.translations, { onDelete: 'CASCADE' })
  ingredient: Ingredient;

  @Column({ length: 5 })
  language: string; // ISO 639-1: 'en', 'ru', 'de'...

  @Column()
  name: string;
}
