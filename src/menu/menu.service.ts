// menu/menu.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuEntry } from './menu-entry.entity';
import { Recipe } from '../recipes/recipe.entity';
import { AddMenuEntryDto } from './dto/add-menu-entry.dto';
import { RecipeLocalizer } from '../recipes/recipe-localizer.service';
import {
  Totals,
  emptyTotals,
  addTotals,
  roundTotals,
  computeRecipeTotals,
} from '../recipes/recipe-totals';


@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuEntry) private menuRepo: Repository<MenuEntry>,
    @InjectRepository(Recipe) private recipeRepo: Repository<Recipe>,
    private localizer: RecipeLocalizer,
  ) {}

  // меню на неделю: 7 дней, в каждом — приёмы пищи с посчитанными калориями/БЖУ
  async getWeek(userId: number, lang: string) {
    const entries = await this.menuRepo.find({
      where: { userId },
      relations: {
        recipe: { ingredients: { ingredient: true }, translations: true },
      },
      order: { dayOfWeek: 'ASC', id: 'ASC' },
    });
    const names = await this.localizer.names(
      entries.map((e) => e.recipe),
      lang,
    );

    const days = Array.from({ length: 7 }, (_, dayOfWeek) => {
      const dayEntries = entries.filter((e) => e.dayOfWeek === dayOfWeek);
      const meals = dayEntries.map((e) => {
        const totals = roundTotals(computeRecipeTotals(e.recipe));
        return {
          entryId: e.id,
          mealType: e.mealType,
          recipeId: e.recipe.id,
          recipeName: names.get(e.recipe.id)!.text,
          ...totals,
        };
      });
      const dayTotal = roundTotals(
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
      return { dayOfWeek, meals, total: dayTotal };
    });

    const weekTotal = roundTotals(
      days.reduce((acc, d) => addTotals(acc, d.total), emptyTotals()),
    );

    return { days, weekTotal };
  }

  async addEntry(userId: number, dto: AddMenuEntryDto) {
    // в меню можно добавить только публичный или свой рецепт
    const recipe = await this.recipeRepo.findOne({
      where: [
        { id: dto.recipeId, isPublic: true },
        { id: dto.recipeId, authorId: userId },
      ],
    });
    if (!recipe) throw new NotFoundException('Recipe not found');

    const entry = this.menuRepo.create({
      userId,
      dayOfWeek: dto.dayOfWeek,
      mealType: dto.mealType,
      recipeId: recipe.id,
    });
    await this.menuRepo.save(entry);
    return { id: entry.id };
  }

  async removeEntry(userId: number, entryId: number) {
    const result = await this.menuRepo.delete({ id: entryId, userId });
    if (!result.affected) throw new NotFoundException('Menu entry not found');
    return { removed: true };
  }

  // сумма ингредиентов по всем рецептам недельного меню — список покупок
  async getShoppingList(userId: number, lang: string) {
    const entries = await this.menuRepo.find({
      where: { userId },
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
        const amount = Number(ri.amount);

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
