// recipes/recipes.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recipe } from './recipe.entity';
import { RecipeIngredient } from './recipe-ingredient.entity';
import { RecipeStep } from './recipe-step.entity';
import { RecipeLike } from './recipe-like.entity';
import { Ingredient } from '../ingredients/ingredient.entity';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { computeRecipeTotals } from './recipe-totals';
import { RecipeLocalizer, LocalizedText } from './recipe-localizer.service';

@Injectable()
export class RecipesService {
  constructor(
    @InjectRepository(Recipe) private recipeRepo: Repository<Recipe>,
    @InjectRepository(RecipeIngredient)
    private recipeIngredientRepo: Repository<RecipeIngredient>,
    @InjectRepository(RecipeStep)
    private recipeStepRepo: Repository<RecipeStep>,
    @InjectRepository(Ingredient)
    private ingredientRepo: Repository<Ingredient>,
    @InjectRepository(RecipeLike)
    private recipeLikeRepo: Repository<RecipeLike>,
    private localizer: RecipeLocalizer,
  ) {}

  // публичные рецепты + свои (в т.ч. приватные)
  private visibleTo(userId: number) {
    return [{ isPublic: true }, { authorId: userId }];
  }

  // рецепт, который юзер имеет право видеть; чужой приватный — как будто его нет
  async findVisible(id: number, userId: number) {
    const recipe = await this.recipeRepo.findOne({
      where: this.visibleTo(userId).map((cond) => ({ id, ...cond })),
    });
    if (!recipe) throw new NotFoundException('Recipe not found');
    return recipe;
  }

  // lang — язык, на котором юзер пишет рецепт (язык интерфейса); на остальные переведётся при просмотре
  async create(userId: number, dto: CreateRecipeDto, lang: string) {
    const recipe = this.recipeRepo.create({
      name: dto.name,
      originalLanguage: lang,
      authorId: userId,
      isPublic: dto.isPublic ?? true,
    });
    await this.recipeRepo.save(recipe);

    for (const item of dto.ingredients) {
      const ingredient = await this.ingredientRepo.findOne({
        where: { id: item.ingredientId },
      });
      if (!ingredient)
        throw new NotFoundException(
          `Ingredient ${item.ingredientId} not found`,
        );

      const ri = this.recipeIngredientRepo.create({
        recipe,
        ingredient,
        amount: item.amount,
      });
      await this.recipeIngredientRepo.save(ri);
    }

    for (const step of dto.steps) {
      const s = this.recipeStepRepo.create({
        recipe,
        stepNum: step.stepNum,
        stepText: step.stepText,
      });
      await this.recipeStepRepo.save(s);
    }

    return this.findOne(recipe.id, lang, userId);
  }

  // список рецептов — базовая инфа + liked-флаг для текущего юзера
  // q ищет по названию рецепта и по названиям ингредиентов (на любом языке, включая переводы);
  // min/maxCalories — калорийность всего рецепта; ingredientIds — рецепт содержит ВСЕ выбранные продукты
  async findAll(
    userId: number,
    lang: string,
    filters: {
      q?: string;
      minCalories?: number;
      maxCalories?: number;
      ingredientIds?: number[];
    } = {},
  ) {
    const recipes = await this.recipeRepo.find({
      where: this.visibleTo(userId),
      relations: {
        ingredients: { ingredient: { translations: true } },
        translations: true,
      },
      order: { id: 'DESC' },
    });
    const likedIds = await this.likedRecipeIds(userId);
    const q = filters.q?.trim().toLowerCase();
    const required = filters.ingredientIds ?? [];

    const matched = recipes
      .filter((r) =>
        required.every((id) =>
          r.ingredients.some((ri) => ri.ingredient.id === id),
        ),
      )
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.translations.some((t) => t.name.toLowerCase().includes(q)) ||
          r.ingredients.some((ri) =>
            ri.ingredient.translations?.some((t) =>
              t.name.toLowerCase().includes(q),
            ),
          ),
      )
      .filter((r) => {
        const calories = Math.round(computeRecipeTotals(r).calories);
        return (
          (filters.minCalories == null || calories >= filters.minCalories) &&
          (filters.maxCalories == null || calories <= filters.maxCalories)
        );
      });

    // переводим только то, что реально покажем
    const names = await this.localizer.names(matched, lang);
    return matched.map((r) =>
      this.toListItem(r, userId, likedIds.has(r.id), names.get(r.id)!),
    );
  }

  // продукты, которые встречаются в доступных юзеру рецептах — варианты для фильтра
  async usedIngredients(userId: number, lang: string) {
    const recipes = await this.recipeRepo.find({
      where: this.visibleTo(userId),
      relations: { ingredients: { ingredient: { translations: true } } },
    });

    const byId = new Map<number, string>();
    for (const r of recipes) {
      for (const { ingredient: ing } of r.ingredients) {
        if (byId.has(ing.id)) continue;
        const translation =
          ing.translations?.find((t) => t.language === lang) ||
          ing.translations?.find((t) => t.language === 'en');
        byId.set(ing.id, translation?.name || ing.slug);
      }
    }

    return [...byId]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }

  // рецепт с загруженными ingredients->ingredient, иначе calories = 0
  private toListItem(
    r: Recipe,
    userId: number,
    liked: boolean,
    name: LocalizedText,
  ) {
    return {
      id: r.id,
      name: name.text,
      autoTranslated: name.autoTranslated,
      liked,
      isPublic: r.isPublic,
      isMine: r.authorId === userId,
      calories: Math.round(computeRecipeTotals(r).calories),
    };
  }

  // конкретный рецепт — с ингредиентами (CPF пересчитан по amount) и шагами по порядку
  async findOne(id: number, lang: string, userId: number) {
    const recipe = await this.recipeRepo.findOne({
      where: this.visibleTo(userId).map((cond) => ({ id, ...cond })),
      relations: {
        ingredients: { ingredient: { translations: true } },
        steps: { translations: true },
        translations: true,
      },
    });
    if (!recipe) throw new NotFoundException('Recipe not found');

    let totalCalories = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalCarbs = 0;

    const ingredients = recipe.ingredients.map((ri) => {
      const factor = ri.amount / 100;
      const calories = ri.ingredient.caloriesPer100g * factor;
      const protein = ri.ingredient.proteinPer100g * factor;
      const fat = ri.ingredient.fatPer100g * factor;
      const carbs = ri.ingredient.carbsPer100g * factor;

      totalCalories += calories;
      totalProtein += protein;
      totalFat += fat;
      totalCarbs += carbs;

      const translation =
        ri.ingredient.translations?.find((t) => t.language === lang) ||
        ri.ingredient.translations?.find((t) => t.language === 'en');

      return {
        ingredientId: ri.ingredient.id,
        name: translation?.name || ri.ingredient.slug,
        amount: ri.amount,
        calories: +calories.toFixed(2),
        protein: +protein.toFixed(2),
        fat: +fat.toFixed(2),
        carbs: +carbs.toFixed(2),
      };
    });

    const name = (await this.localizer.names([recipe], lang)).get(recipe.id)!;
    const stepTexts = await this.localizer.steps(recipe, recipe.steps, lang);
    const steps = recipe.steps
      .sort((a, b) => a.stepNum - b.stepNum)
      .map((s) => ({ stepNum: s.stepNum, stepText: stepTexts.get(s.id)!.text }));

    const liked =
      (await this.recipeLikeRepo.count({ where: { userId, recipeId: id } })) > 0;

    return {
      id: recipe.id,
      name: name.text,
      originalLanguage: recipe.originalLanguage,
      // хоть что-то (название или шаг) перевёл DeepL — фронт покажет «переведено автоматически»
      autoTranslated:
        name.autoTranslated ||
        [...stepTexts.values()].some((s) => s.autoTranslated),
      ingredients,
      steps,
      liked,
      isPublic: recipe.isPublic,
      isMine: recipe.authorId === userId,
      total: {
        calories: +totalCalories.toFixed(2),
        protein: +totalProtein.toFixed(2),
        fat: +totalFat.toFixed(2),
        carbs: +totalCarbs.toFixed(2),
      },
    };
  }

  async likeRecipe(userId: number, recipeId: number) {
    await this.findVisible(recipeId, userId);

    const existing = await this.recipeLikeRepo.findOne({
      where: { userId, recipeId },
    });
    if (existing) return { liked: true };

    try {
      const like = this.recipeLikeRepo.create({ userId, recipeId });
      await this.recipeLikeRepo.save(like);
    } catch {
      // race with a concurrent like from the same user — unique constraint already covers it
      throw new ConflictException('Recipe already liked');
    }
    return { liked: true };
  }

  async unlikeRecipe(userId: number, recipeId: number) {
    await this.recipeLikeRepo.delete({ userId, recipeId });
    return { liked: false };
  }

  async getLikedRecipes(userId: number, lang: string) {
    const likes = await this.recipeLikeRepo.find({
      where: { userId },
      relations: {
        recipe: { ingredients: { ingredient: true }, translations: true },
      },
      order: { createdAt: 'DESC' },
    });
    // чужой рецепт мог стать недоступен — не показываем
    const recipes = likes
      .map((l) => l.recipe)
      .filter((r) => r && (r.isPublic || r.authorId === userId));
    const names = await this.localizer.names(recipes, lang);
    return recipes.map((r) =>
      this.toListItem(r, userId, true, names.get(r.id)!),
    );
  }

  private async likedRecipeIds(userId: number): Promise<Set<number>> {
    const likes = await this.recipeLikeRepo.find({ where: { userId } });
    return new Set(likes.map((l) => l.recipeId));
  }
}
