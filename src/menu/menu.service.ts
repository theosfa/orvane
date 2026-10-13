// menu/menu.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, In, Repository } from 'typeorm';
import { MenuEntry } from './menu-entry.entity';
import { Recipe } from '../recipes/recipe.entity';
import { RecipeLike } from '../recipes/recipe-like.entity';
import { AddMenuEntryDto, MenuMealDto } from './dto/add-menu-entry.dto';
import { RecipeLocalizer } from '../recipes/recipe-localizer.service';
import {
  Totals,
  emptyTotals,
  addTotals,
  roundTotals,
  computeRecipeTotals,
} from '../recipes/recipe-totals';
import { scaleAmount } from '../recipes/servings';
import { addDays, isISODate } from '../common/dates';
import { Scope, ownedBy, ownerFields } from '../family/scope';

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];

// КБЖУ одной порции: рецепт целиком / на сколько человек он рассчитан
function perServing(recipe: Recipe): Totals {
  const t = computeRecipeTotals(recipe);
  const n = recipe.servings || 1;
  return {
    calories: t.calories / n,
    protein: t.protein / n,
    fat: t.fat / n,
    carbs: t.carbs / n,
  };
}

@Injectable()
export class MenuService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(MenuEntry) private menuRepo: Repository<MenuEntry>,
    @InjectRepository(Recipe) private recipeRepo: Repository<Recipe>,
    @InjectRepository(RecipeLike) private likeRepo: Repository<RecipeLike>,
    private localizer: RecipeLocalizer,
  ) {}

  // меню на неделю с понедельника weekStart: 7 дней с датами, приёмы пищи и КБЖУ.
  // Калории — на одного человека (сколько съест каждый), servings — на скольких готовим.
  // scope — личное меню или общее меню семьи
  async getWeek(scope: Scope, weekStart: string, lang: string) {
    const weekEnd = addDays(weekStart, 6);
    const entries = await this.menuRepo.find({
      where: { ...ownedBy(scope), date: Between(weekStart, weekEnd) },
      relations: {
        recipe: { ingredients: { ingredient: true }, translations: true },
        user: true,
      },
      order: { date: 'ASC', id: 'ASC' },
    });
    const names = await this.localizer.names(
      entries.map((e) => e.recipe),
      lang,
    );

    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const meals = entries
        .filter((e) => e.date === date)
        .sort(
          (a, b) =>
            MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType) ||
            a.id - b.id,
        )
        .map((e) => ({
          entryId: e.id,
          mealType: e.mealType,
          recipeId: e.recipe.id,
          recipeName: names.get(e.recipe.id)!.text,
          servings: e.servings,
          // кто добавил — видно в семейном меню
          addedBy: e.user?.email ?? null,
          ...roundTotals(perServing(e.recipe)),
        }));
      const total = roundTotals(
        meals.reduce(
          (acc, m) =>
            addTotals(acc, {
              calories: m.calories,
              protein: m.protein,
              fat: m.fat,
              carbs: m.carbs,
            }),
          emptyTotals(),
        ),
      );
      return { date, meals, total };
    });

    const weekTotal = roundTotals(
      days.reduce((acc, d) => addTotals(acc, d.total), emptyTotals()),
    );

    return { weekStart, days, weekTotal };
  }

  // в меню попадают только рецепты, которые лайкнул сам добавляющий (и по-прежнему может видеть);
  // alreadyThere — уже стоящие в этом дне блюда (в семье их мог добавить другой админ)
  private async assertLiked(
    userId: number,
    recipeIds: number[],
    alreadyThere: number[] = [],
  ) {
    const unique = [...new Set(recipeIds)].filter((id) => !alreadyThere.includes(id));
    if (!unique.length) return;
    const likes = await this.likeRepo.find({
      where: { userId, recipeId: In(unique) },
      relations: { recipe: true },
    });
    const allowed = new Set(
      likes
        .filter((l) => l.recipe.isPublic || l.recipe.authorId === userId)
        .map((l) => l.recipeId),
    );
    const missing = unique.filter((id) => !allowed.has(id));
    if (missing.length) {
      throw new BadRequestException(
        `Only liked recipes can be added to the menu (recipe ${missing.join(', ')})`,
      );
    }
  }

  private assertDate(date: string) {
    if (!isISODate(date)) throw new BadRequestException('Invalid date');
  }

  async addEntry(scope: Scope, dto: AddMenuEntryDto) {
    this.assertDate(dto.date);
    await this.assertLiked(scope.userId, [dto.recipeId]);
    const entry = await this.menuRepo.save(
      this.menuRepo.create({
        ...ownerFields(scope),
        date: dto.date,
        mealType: dto.mealType,
        recipeId: dto.recipeId,
        servings: dto.servings,
      }),
    );
    return { id: entry.id };
  }

  // день целиком: всё, что было на эту дату, заменяется переданным списком (атомарно)
  async setDay(scope: Scope, date: string, meals: MenuMealDto[]) {
    this.assertDate(date);
    const current = await this.menuRepo.find({ where: { ...ownedBy(scope), date } });
    await this.assertLiked(
      scope.userId,
      meals.map((m) => m.recipeId),
      current.map((e) => e.recipeId),
    );
    // блюдо, которое было в дне и осталось, сохраняет своего автора
    const authorOf = new Map(current.map((e) => [e.recipeId, e.userId]));
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(MenuEntry, { ...ownedBy(scope), date });
      if (meals.length) {
        await manager.save(
          meals.map((m) =>
            manager.create(MenuEntry, {
              ...ownerFields(scope),
              userId: authorOf.get(m.recipeId) ?? scope.userId,
              date,
              mealType: m.mealType,
              recipeId: m.recipeId,
              servings: m.servings,
            }),
          ),
        );
      }
    });
    return { saved: meals.length };
  }

  async removeEntry(scope: Scope, entryId: number) {
    const entry = await this.menuRepo.findOne({ where: { id: entryId, ...ownedBy(scope) } });
    if (!entry) throw new NotFoundException('Menu entry not found');
    await this.menuRepo.delete({ id: entryId });
    return { removed: true };
  }

  // список покупок за выбранные дни: ингредиенты всех рецептов, пересчитанные
  // на число человек в каждом приёме пищи, одинаковые продукты сложены
  async getShoppingList(scope: Scope, dates: string[], lang: string) {
    if (!dates.length) throw new BadRequestException('Choose at least one day');
    dates.forEach((d) => this.assertDate(d));

    const entries = await this.menuRepo.find({
      where: { ...ownedBy(scope), date: In([...new Set(dates)]) },
      relations: {
        recipe: { ingredients: { ingredient: { translations: true } } },
      },
    });

    const totals = new Map<number, { name: string; amount: number }>();
    for (const entry of entries) {
      for (const ri of entry.recipe.ingredients ?? []) {
        const translation =
          ri.ingredient.translations?.find((t) => t.language === lang) ||
          ri.ingredient.translations?.find((t) => t.language === 'en');
        const name = translation?.name || ri.ingredient.slug;
        const amount = scaleAmount(
          Number(ri.amount),
          entry.recipe.servings || 1,
          entry.servings,
        );

        const prev = totals.get(ri.ingredient.id);
        if (prev) prev.amount += amount;
        else totals.set(ri.ingredient.id, { name, amount });
      }
    }

    return Array.from(totals.entries())
      .map(([ingredientId, v]) => ({
        ingredientId,
        name: v.name,
        amount: +v.amount.toFixed(2),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }
}
