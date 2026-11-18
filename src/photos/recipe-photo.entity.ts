// photos/recipe-photo.entity.ts
import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Recipe } from '../recipes/recipe.entity';
import { User } from '../users/users.entity';

// Фото блюда. Файл — PHOTOS_DIR/<id>.webp, в базе только метаданные.
// recipeId = null — загружено/сгенерировано, но рецепт ещё не сохранён; такие через сутки удаляются.
@Entity('recipe_photos')
export class RecipePhoto {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Recipe, (r) => r.photos, { onDelete: 'CASCADE', nullable: true })
  recipe: Recipe | null;

  @Index()
  @Column({ type: 'int', nullable: true })
  recipeId: number | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  uploader: User;

  @Column({ type: 'int' })
  uploaderId: number;

  // порядок в галерее рецепта; 0 — главное фото (на карточках)
  @Column({ type: 'smallint', default: 0 })
  position: number;

  // 'upload' — загрузил человек, 'ai' — сгенерировано по рецепту
  @Column({ length: 10, default: 'upload' })
  source: string;

  @CreateDateColumn()
  createdAt: Date;
}
