// menu/menu-entry.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/users.entity';
import { Recipe } from '../recipes/recipe.entity';

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

@Entity('menu_entries')
export class MenuEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: number;

  // 0 = понедельник .. 6 = воскресенье
  @Column('smallint')
  dayOfWeek: number;

  @Column({ type: 'varchar', length: 20, default: 'dinner' })
  mealType: MealType;

  @ManyToOne(() => Recipe, { onDelete: 'CASCADE' })
  recipe: Recipe;

  @Column()
  recipeId: number;

  @CreateDateColumn()
  createdAt: Date;
}
