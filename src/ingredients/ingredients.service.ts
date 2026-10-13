// ingredients/ingredients.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Ingredient } from './ingredient.entity';
import { IngredientTranslation } from './ingredient-translation.entity';
import { TranslationService } from '../translation/translation.service';

@Injectable()
export class IngredientsService {
  constructor(
    @InjectRepository(Ingredient)
    private ingredientRepo: Repository<Ingredient>,
    @InjectRepository(IngredientTranslation)
    private translationRepo: Repository<IngredientTranslation>,
    private translationService: TranslationService,
  ) {}

  // список ингредиентов с названием на нужном языке + CPF (calories/protein/fat)
  async findAll(lang: string) {
    const ingredients = await this.ingredientRepo.find({
      relations: { translations: true },
    });

    return Promise.all(
      ingredients.map(async (ing) => ({
        id: ing.id,
        name: await this.resolveName(ing, lang),
        caloriesPer100g: ing.caloriesPer100g,
        proteinPer100g: ing.proteinPer100g,
        fatPer100g: ing.fatPer100g,
        carbsPer100g: ing.carbsPer100g,
      })),
    );
  }

  // поиск по словам в названии (на языке юзера + en как фолбэк): "olive oil" найдёт "Oil, olive";
  // совпадения с начала и короткие названия — выше
  async search(q: string, lang: string, limit = 20) {
    const escape = (v: string) => v.replace(/[\\%_]/g, '\\$&');
    const term = q.trim();
    const words = term.split(/\s+/).filter(Boolean).slice(0, 5);
    if (!words.length) return [];

    const wordConds = words.map((_, i) => `t.name ILIKE $${i + 4}`).join(' AND ');
    const rows: { id: number }[] = await this.translationRepo.query(
      `SELECT t."ingredientId" AS id
         FROM ingredient_translations t
        WHERE t.language IN ($1, 'en') AND ${wordConds}
        GROUP BY t."ingredientId"
        ORDER BY MIN(CASE WHEN t.name ILIKE $2 THEN 0 ELSE 1 END), MIN(LENGTH(t.name))
        LIMIT $3`,
      [lang, `${escape(term)}%`, limit, ...words.map((w) => `%${escape(w)}%`)],
    );
    if (!rows.length) return [];

    const ids = rows.map((r) => r.id);
    const ingredients = await this.ingredientRepo.find({
      where: { id: In(ids) },
      relations: { translations: true },
    });
    const byId = new Map(ingredients.map((ing) => [ing.id, ing]));

    return Promise.all(
      ids
        .map((id) => byId.get(id))
        .filter((ing): ing is Ingredient => !!ing)
        .map(async (ing) => ({
          id: ing.id,
          name: await this.resolveName(ing, lang),
          caloriesPer100g: ing.caloriesPer100g,
          proteinPer100g: ing.proteinPer100g,
          fatPer100g: ing.fatPer100g,
          carbsPer100g: ing.carbsPer100g,
        })),
    );
  }

  async findOne(id: number, lang: string) {
    const ing = await this.ingredientRepo.findOne({
      where: { id },
      relations: { translations: true },
    });
    if (!ing) throw new NotFoundException('Ingredient not found');

    return {
      id: ing.id,
      name: await this.resolveName(ing, lang),
      caloriesPer100g: ing.caloriesPer100g,
      proteinPer100g: ing.proteinPer100g,
      fatPer100g: ing.fatPer100g,
      carbsPer100g: ing.carbsPer100g,
    };
  }

  // если перевода нет в БД — переводим на лету через API и сохраняем (кешируем навсегда);
  // источник — английское название, иначе любое имеющееся (продукт юзера может быть только на его языке)
  private async resolveName(ing: Ingredient, lang: string): Promise<string> {
    const existing = ing.translations?.find((t) => t.language === lang);
    if (existing) return existing.name;

    const source =
      ing.translations?.find((t) => t.language === 'en') ??
      ing.translations?.[0];
    if (!source) return ing.slug;

    let translated: string;
    try {
      translated = await this.translationService.translate(
        source.name,
        lang,
        source.language,
      );
    } catch {
      return source.name; // DeepL недоступен — покажем как есть, переведём в следующий раз
    }

    await this.translationRepo
      .createQueryBuilder()
      .insert()
      .values({ ingredient: ing, language: lang, name: translated })
      .orIgnore() // параллельный запрос мог уже сохранить этот перевод
      .execute();

    return translated;
  }

  // юзер добавляет продукт по имени — slug технический, выводится из имени + суффикс для уникальности;
  // название сохраняется на языке, на котором его ввели (lang), остальные языки переведутся при запросе
  async createFromName(
    data: {
      name: string;
      caloriesPer100g: number;
      proteinPer100g: number;
      fatPer100g: number;
      carbsPer100g: number;
    },
    lang: string,
  ) {
    const base =
      data.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'ingredient';
    const slug = `${base}-${Date.now().toString(36)}`;

    return this.create({
      slug,
      caloriesPer100g: data.caloriesPer100g,
      proteinPer100g: data.proteinPer100g,
      fatPer100g: data.fatPer100g,
      carbsPer100g: data.carbsPer100g,
      translations: [{ language: lang, name: data.name }],
    });
  }

  async create(data: {
    slug: string;
    caloriesPer100g: number;
    proteinPer100g: number;
    fatPer100g: number;
    carbsPer100g: number;
    translations: { language: string; name: string }[];
  }) {
    const ingredient = this.ingredientRepo.create({
      slug: data.slug,
      caloriesPer100g: data.caloriesPer100g,
      proteinPer100g: data.proteinPer100g,
      fatPer100g: data.fatPer100g,
      carbsPer100g: data.carbsPer100g,
    });
    await this.ingredientRepo.save(ingredient);

    for (const t of data.translations) {
      const translation = this.translationRepo.create({
        ingredient,
        language: t.language,
        name: t.name,
      });
      await this.translationRepo.save(translation);
    }

    return this.findOne(ingredient.id, data.translations[0]?.language ?? 'en');
  }
}
