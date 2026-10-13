// menu/menu-entry.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/users.entity';
import { Family } from '../family/family.entity';
import { Recipe } from '../recipes/recipe.entity';

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

// сколько человек можно выбрать для одного приёма пищи
export const MAX_MENU_SERVINGS = 12;

@Entity('menu_entries')
@Index(['userId', 'date'])
export class MenuEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: number;

  // задан — запись семейная (userId = кто создал), null — личная
  @ManyToOne(() => Family, { onDelete: 'CASCADE', nullable: true })
  family: Family | null;

  @Column({ type: 'int', nullable: true })
  familyId: number | null;

  // конкретный день, 'YYYY-MM-DD' — можно планировать будущие недели и смотреть прошлые
  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 20, default: 'dinner' })
  mealType: MealType;

  @ManyToOne(() => Recipe, { onDelete: 'CASCADE' })
  recipe: Recipe;

  @Column()
  recipeId: number;

  // на сколько человек готовим — количества рецепта пересчитываются под это число
  @Column({ type: 'smallint', default: 1 })
  servings: number;

  @CreateDateColumn()
  createdAt: Date;
}
