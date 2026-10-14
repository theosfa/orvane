// stats/stats.service.ts — цифры для профиля: что юзер сам сделал в приложении
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recipe } from '../recipes/recipe.entity';
import { RecipeLike } from '../recipes/recipe-like.entity';
import { MenuEntry } from '../menu/menu-entry.entity';
import { Task } from '../tasks/task.entity';
import { startOfWeek } from '../common/dates';

export type UserStats = {
  recipesWritten: number; // рецепты, где он автор
  recipesLiked: number;
  weeksPlanned: number; // недели, в меню которых он добавил хоть одно блюдо (своё или семейное)
  tasksDone: number; // выполненные задачи, которые он создал
};

// драйверы отдают колонку date по-разному: строкой 'YYYY-MM-DD' или Date
const isoDay = (v: string | Date) => (typeof v === 'string' ? v.slice(0, 10) : v.toISOString().slice(0, 10));

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Recipe) private recipeRepo: Repository<Recipe>,
    @InjectRepository(RecipeLike) private likeRepo: Repository<RecipeLike>,
    @InjectRepository(MenuEntry) private menuRepo: Repository<MenuEntry>,
    @InjectRepository(Task) private taskRepo: Repository<Task>,
  ) {}

  async forUser(userId: number): Promise<UserStats> {
    const [recipesWritten, recipesLiked, days, tasksDone] = await Promise.all([
      this.recipeRepo.countBy({ authorId: userId }),
      this.likeRepo.countBy({ userId }),
      this.menuRepo
        .createQueryBuilder('m')
        .select('DISTINCT m.date', 'date')
        .where('m.userId = :userId', { userId })
        .getRawMany<{ date: string | Date }>(),
      this.taskRepo.countBy({ userId, done: true }),
    ]);
    const weeks = new Set(days.map((d) => startOfWeek(isoDay(d.date))));
    return { recipesWritten, recipesLiked, weeksPlanned: weeks.size, tasksDone };
  }
}
