// recipes/recipe-like.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/users.entity';
import { Recipe } from './recipe.entity';

@Entity('recipe_likes')
@Unique(['user', 'recipe'])
export class RecipeLike {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Recipe, { onDelete: 'CASCADE' })
  recipe: Recipe;

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  userId: number;

  @Column()
  recipeId: number;
}
