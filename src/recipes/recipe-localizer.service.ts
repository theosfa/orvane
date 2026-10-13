// recipes/recipe-localizer.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recipe } from './recipe.entity';
import { RecipeStep } from './recipe-step.entity';
import { RecipeTranslation } from './recipe-translation.entity';
import { RecipeStepTranslation } from './recipe-step-translation.entity';
import { TranslationService } from '../translation/translation.service';

// текст на нужном языке; autoTranslated — его перевёл DeepL, а не автор
export type LocalizedText = { text: string; autoTranslated: boolean };

// Отдаёт название и шаги рецепта на языке юзера. Порядок: язык оригинала -> сохранённый перевод ->
// перевод через DeepL (пачкой, сохраняется навсегда) -> если DeepL недоступен, оригинал.
@Injectable()
export class RecipeLocalizer {
  private readonly logger = new Logger(RecipeLocalizer.name);

  constructor(
    @InjectRepository(RecipeTranslation)
    private nameRepo: Repository<RecipeTranslation>,
    @InjectRepository(RecipeStepTranslation)
    private stepRepo: Repository<RecipeStepTranslation>,
    private translationService: TranslationService,
  ) {}

  // рецепты должны быть загружены с relations.translations
  async names(recipes: Recipe[], lang: string): Promise<Map<number, LocalizedText>> {
    const result = new Map<number, LocalizedText>();
    const missing = new Map<number, Recipe>(); // один рецепт может встретиться несколько раз (меню)

    for (const r of recipes) {
      if (result.has(r.id) || missing.has(r.id)) continue;
      const known = this.known(r.originalLanguage, r.name, r.translations, lang, (t) => t.name);
      if (known) result.set(r.id, known);
      else missing.set(r.id, r);
    }
    if (!missing.size) return result;

    const todo = [...missing.values()];
    const translated = await this.machineTranslate(todo.map((r) => r.name), lang);
    todo.forEach((r, i) => result.set(r.id, translated[i] ?? { text: r.name, autoTranslated: false }));

    if (translated.length) {
      await this.nameRepo
        .createQueryBuilder()
        .insert()
        .values(todo.map((r, i) => ({ recipeId: r.id, language: lang, name: translated[i].text })))
        .orIgnore() // параллельный запрос мог уже сохранить перевод
        .execute();
    }
    return result;
  }

  // шаги должны быть загружены с relations.translations
  async steps(recipe: Recipe, steps: RecipeStep[], lang: string): Promise<Map<number, LocalizedText>> {
    const result = new Map<number, LocalizedText>();
    const missing: RecipeStep[] = [];

    for (const s of steps) {
      const known = this.known(recipe.originalLanguage, s.stepText, s.translations, lang, (t) => t.text);
      if (known) result.set(s.id, known);
      else missing.push(s);
    }
    if (!missing.length) return result;

    const translated = await this.machineTranslate(missing.map((s) => s.stepText), lang);
    missing.forEach((s, i) => result.set(s.id, translated[i] ?? { text: s.stepText, autoTranslated: false }));

    if (translated.length) {
      await this.stepRepo
        .createQueryBuilder()
        .insert()
        .values(missing.map((s, i) => ({ stepId: s.id, language: lang, text: translated[i].text })))
        .orIgnore()
        .execute();
    }
    return result;
  }

  private known<T extends { language: string; isMachine: boolean }>(
    originalLanguage: string,
    original: string,
    translations: T[] | undefined,
    lang: string,
    text: (t: T) => string,
  ): LocalizedText | null {
    if (originalLanguage === lang) return { text: original, autoTranslated: false };
    const t = translations?.find((x) => x.language === lang);
    return t ? { text: text(t), autoTranslated: t.isMachine } : null;
  }

  // [] — DeepL недоступен; тогда ничего не сохраняем и показываем оригинал
  private async machineTranslate(texts: string[], lang: string): Promise<LocalizedText[]> {
    try {
      const out = await this.translationService.translateMany(texts, lang, null);
      return out.map((text) => ({ text, autoTranslated: true }));
    } catch (err) {
      this.logger.warn(`Recipe translation to "${lang}" failed: ${(err as Error).message}`);
      return [];
    }
  }
}
