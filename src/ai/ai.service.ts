// ai/ai.service.ts
import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { IngredientsService } from '../ingredients/ingredients.service';
import { toLanguage, type Language } from '../common/languages';
import { clampServings } from '../recipes/servings';
import { sanitizeNutrition } from '../ingredients/ingredient-name';
import { checkTarget, computeTotals, type ModelRecipe } from './recipe-target';

// продукты, которых нет в базе, добавляются в неё с КБЖУ от модели;
// ingredientId = null — только если модель не дала КБЖУ: фронт покажет продукт, чтобы юзер выбрал замену сам
type GeneratedRecipe = {
  name: string;
  servings: number;
  ingredients: { ingredientId: number | null; name: string; amount: number }[];
  steps: { stepNum: number; stepText: string }[];
};

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
// gpt-5.4-mini: ~4 c на рецепт и хорошо держит цели по КБЖУ; полные gpt-5.5+ заметно лучше пишут,
// но отвечают 40+ c — больше таймаута прокси фронта. Переопределяется через CHAT_GPT_MODEL.
const DEFAULT_MODEL = 'gpt-5.4-mini';

const LANG_NAMES: Record<Language, string> = {
  ru: 'Russian',
  en: 'English',
  pl: 'Polish',
  fr: 'French',
  uk: 'Ukrainian',
};

function buildSystemPrompt(language: string): string {
  return [
    'You are an experienced chef and nutritionist writing recipes for a meal-planning app. Home cooks must be able to follow them without guessing.',
    'Respond with ONLY strict JSON, no markdown, matching exactly this shape:',
    '{"name": string, "servings": number, "target": {"calories"?: number, "protein"?: number, "fat"?: number, "carbs"?: number, "mode": "about" | "atLeast" | "atMost"} | null, "ingredients": [{"name": string, "searchName": string, "baseName": string, "amount": number, "per100g": {"calories": number, "protein": number, "fat": number, "carbs": number}}], "steps": [string]}',
    '',
    'Choosing the dish:',
    '- Pick ONE specific, appetizing dish with a real name that a good home cook or a bistro would serve (e.g. "Chicken teriyaki with jasmine rice and sesame broccoli", "Greek chicken souvlaki with tzatziki and roasted potatoes").',
    '- If the request is vague (it only names an ingredient, a meal like "dinner", or a nutrition goal), make a complete, balanced meal: the main protein + a side (grain, potatoes, pasta, bread or legumes) + vegetables + a sauce, marinade or spice mix that gives real flavour.',
    '- Never answer with a bare ingredient boiled, fried or baked on its own, and never with plain broth. Make soups, salads or single-component dishes only when the request asks for them.',
    '- Respect everything the request says (ingredients, cuisine, time, diet, equipment). "Quick" means about 30 minutes or less of total cooking.',
    '',
    'Servings and nutrition targets:',
    '- "servings" is how many people the amounts feed (an integer, usually 2-4 unless the request says otherwise).',
    '- If the request gives a numeric nutrition target (e.g. "150 g protein", "under 600 kcal") but does not say for how many people, use servings = 1 so the target is the whole dish.',
    '- Otherwise targets are PER SERVING. Choose ingredient amounts so the target is really met: per serving = sum(per100g × amount / 100) / servings, within ±10% for "about", not below for "atLeast", not above for "atMost". Increase the protein source rather than adding protein powder.',
    '- Copy the numeric targets into "target" (per serving, with the right "mode"); use null when the request has no numeric targets.',
    '',
    'Ingredients:',
    '- List EVERY ingredient used, including oil/butter for frying, salt, pepper, spices, herbs, water or stock, garnish.',
    '- "amount" is grams (convert spoons/pieces/ml to an approximate gram weight; 1 tsp salt ≈ 6 g, 1 tbsp oil ≈ 14 g, 1 medium potato ≈ 170 g). Grains and pasta are weighed dry.',
    '- "name" is the ingredient as shown to the user, in ' + language + ', with its preparation if relevant (e.g. "onion, finely diced").',
    '- "searchName" is a short generic ENGLISH singular noun phrase for database lookup: the most common basic name, no preparation or form words that do not change nutrition ("cumin" not "ground cumin", "oregano" not "dried oregano", "buckwheat" not "buckwheat groats"). Keep words that change the product (e.g. "ground beef", "dried apricot", "vegetable broth", "green curry paste", "chicken breast").',
    '- "baseName" is the same product as searchName in ' + language + ', specific enough to tell it apart from similar products (e.g. "vegetable broth" -> vegetable broth, not just broth), without preparation words.',
    '- "per100g" is the typical nutrition of 100 g of that product in its raw/as-sold form (as in USDA tables): kcal and grams of protein, fat, carbohydrates with one decimal place. Always fill it, use 0 for salt and water.',
    '',
    'Steps (in ' + language + '):',
    '- 5 to 12 steps, in cooking order, each one or two full sentences.',
    '- Say which ingredients go in at that step and how much (e.g. "Add 150 g diced onion and 1 tsp salt").',
    '- Include how to cut/prepare things, heat level, pan/pot/oven temperature, timings, and a doneness cue (e.g. "until golden, 5-7 minutes").',
    '- Finish with how to serve.',
    '',
    '"name" of the recipe is also in ' + language + '.',
  ].join('\n');
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private ingredientsService: IngredientsService) {}

  // Модель пишет полноценный рецепт (с английским searchName у каждого продукта);
  // если в запросе была цель по КБЖУ — проверяем её арифметику сами и один раз просим поправить граммовки;
  // сматчить продукты с базой — задача бэкенда через поиск, а не всей таблицы в промпте.
  async generateRecipe(prompt: string, lang = 'en'): Promise<GeneratedRecipe> {
    const language = LANG_NAMES[toLanguage(lang)];
    const messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(language) },
      { role: 'user', content: `Request: ${prompt}` },
    ];

    let { raw, parsed } = await this.chat(messages);
    let ingredients = await this.resolveIngredients(parsed, lang);

    // цель считаем по КБЖУ из базы: модели часто берут КБЖУ готового продукта вместо сырого
    const totals = computeTotals(ingredients, clampServings(parsed.servings));
    const miss = checkTarget(parsed.target, totals);
    if (miss) {
      this.logger.log(`AI recipe missed its target (${miss}), asking for a correction`);
      messages.push(
        { role: 'assistant', content: raw },
        {
          role: 'user',
          content:
            `Your amounts do not meet the target: ${miss}. ` +
            `With raw-product nutrition the recipe now has per serving ${Math.round(totals.calories)} kcal, ` +
            `${Math.round(totals.protein)} g protein, ${Math.round(totals.fat)} g fat, ${Math.round(totals.carbs)} g carbs. ` +
            'Note that amounts are raw weights (raw chicken breast has ~22 g protein per 100 g, not the cooked value). ' +
            'Keep the same dish but adjust ingredient amounts (and the steps that mention them) so the target is met. ' +
            'Return the full corrected JSON in the same shape.',
        },
      );
      try {
        ({ raw, parsed } = await this.chat(messages));
        ingredients = await this.resolveIngredients(parsed, lang);
      } catch (e) {
        // исправление не удалось — лучше отдать первый вариант, чем ошибку
        this.logger.warn(`AI correction failed: ${(e as Error).message}`);
      }
    }

    return {
      name: parsed.name?.trim() || 'AI-suggested recipe',
      servings: clampServings(parsed.servings),
      ingredients: ingredients.map(({ ingredientId, name, amount }) => ({ ingredientId, name, amount })),
      steps: (parsed.steps ?? [])
        .filter((stepText) => typeof stepText === 'string' && stepText.trim())
        .map((stepText, idx) => ({ stepNum: idx + 1, stepText: stepText.trim() })),
    };
  }

  // сопоставляем продукты с базой (недостающие создаются); по очереди, а не параллельно:
  // один и тот же новый продукт в рецепте дважды не должен создаваться дважды
  private async resolveIngredients(parsed: ModelRecipe, lang: string) {
    const result: (GeneratedRecipe['ingredients'][number] & {
      per100g: Awaited<ReturnType<IngredientsService['findOne']>> | null;
    })[] = [];
    for (const i of parsed.ingredients ?? []) {
      const searchName = (i.searchName || i.name || '').trim();
      if (!searchName || !Number.isFinite(i.amount) || (i.amount as number) <= 0) continue;
      const match = await this.ingredientsService.findOrCreateForAi(
        { searchName, localName: i.baseName, nutrition: sanitizeNutrition(i.per100g) },
        lang,
      );
      result.push({
        ingredientId: match?.id ?? null,
        name: match?.name ?? i.name ?? searchName,
        amount: Math.round(i.amount!),
        per100g: match,
      });
    }
    return result;
  }

  private async chat(messages: ChatMessage[]): Promise<{ raw: string; parsed: ModelRecipe }> {
    const apiKey = process.env.CHAT_GPT_KEY;
    if (!apiKey) {
      throw new InternalServerErrorException('AI assistant is not configured');
    }
    const model = process.env.CHAT_GPT_MODEL || DEFAULT_MODEL;
    // у reasoning-моделей (o*, gpt-5+) temperature не настраивается
    const isReasoning = /^(o\d|gpt-[5-9])/.test(model);

    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        ...(isReasoning ? {} : { temperature: 0.8 }),
        response_format: { type: 'json_object' },
        messages,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // в лог — иначе причину (например, истёкший ключ) не видно нигде
      this.logger.error(`OpenAI request failed (${res.status}): ${detail.slice(0, 500)}`);
      throw new BadGatewayException(
        `AI assistant request failed (${res.status}): ${detail.slice(0, 300)}`,
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) {
      this.logger.error('OpenAI returned an empty response');
      throw new BadGatewayException('AI assistant returned an empty response');
    }

    try {
      return { raw, parsed: JSON.parse(raw) as ModelRecipe };
    } catch {
      this.logger.error(`OpenAI returned malformed JSON: ${raw.slice(0, 300)}`);
      throw new BadGatewayException('AI assistant returned malformed JSON');
    }
  }
}
