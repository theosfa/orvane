// ingredients/ingredient.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { IngredientTranslation } from './ingredient-translation.entity';

@Entity('ingredients')
export class Ingredient {
  @PrimaryGeneratedColumn()
  id: number;

  // технический slug для поиска/сидинга, не показывается юзеру напрямую
  @Column({ unique: true })
  slug: string; // "potato", "tomato"

  @Column('decimal', { precision: 6, scale: 2 })
  caloriesPer100g: number;

  @Column('decimal', { precision: 6, scale: 2 })
  proteinPer100g: number;

  @Column('decimal', { precision: 6, scale: 2 })
  fatPer100g: number;

  @Column('decimal', { precision: 6, scale: 2 })
  carbsPer100g: number;

  @OneToMany(() => IngredientTranslation, (t) => t.ingredient)
  translations: IngredientTranslation[];
}
