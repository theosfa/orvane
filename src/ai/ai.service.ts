// ai/ai.service.ts
import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { IngredientsService } from '../ingredients/ingredients.service';
import { toLanguage, type Language } from '../common/languages';

// ingredientId = null — модель предложила продукт, которого нет в базе;
// фронт покажет его, чтобы юзер выбрал замену сам (раньше такие молча выкидывались)
type GeneratedRecipe = {
  name: string;
  ingredients: { ingredientId: number | null; name: string; amount: number }[];
  steps: { stepNum: number; stepText: string }[];
};

type ModelIngredient = { name?: string; searchName?: string; amount?: number };

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.CHAT_GPT_MODEL || 'gpt-4o-mini';

const LANG_NAMES: Record<Language, string> = {
  ru: 'Russian',
  en: 'English',
  pl: 'Polish',
  fr: 'French',
  uk: 'Ukrainian',
};

@Injectable()
export class AiService {
  constructor(private ingredientsService: IngredientsService) {}

  // Модель пишет полноценный рецепт свободным текстом (с английским searchName у каждого продукта),
  // а сматчить продукты с базой — задача бэкенда через поиск, а не всей таблицы в промпте.
  async generateRecipe(prompt: string, lang = 'en'): Promise<GeneratedRecipe> {
    const apiKey = process.env.CHAT_GPT_KEY;
    if (!apiKey) {
      throw new InternalServerErrorException('AI assistant is not configured');
    }

    const language = LANG_NAMES[toLanguage(lang)];

    const systemPrompt = [
      'You are an experienced chef writing recipes for a meal-planning app. Home cooks must be able to follow them without guessing.',
      'Respond with ONLY strict JSON, no markdown, matching exactly this shape:',
      '{"name": string, "ingredients": [{"name": string, "searchName": string, "amount": number}], "steps": [string]}',
      '',
      'Ingredients:',
      '- List EVERY ingredient used, including oil/butter for frying, salt, pepper, spices, herbs, water or stock, garnish.',
      '- "amount" is grams (convert spoons/pieces/ml to an approximate gram weight; 1 tsp salt ≈ 6 g, 1 tbsp oil ≈ 14 g, 1 medium potato ≈ 170 g).',
      '- "name" is the ingredient as shown to the user, in ' + language + ', with its preparation if relevant (e.g. "onion, finely diced").',
      '- "searchName" is a short generic ENGLISH singular noun phrase for database lookup, no preparation words (e.g. "onion", "olive oil", "chicken breast", "black pepper").',
      '',
      'Steps (in ' + language + '):',
      '- 5 to 12 steps, in cooking order, each one or two full sentences.',
      '- Say which ingredients go in at that step and how much (e.g. "Add 150 g diced onion and 1 tsp salt").',
      '- Include how to cut/prepare things, heat level, pan/pot/oven temperature, timings, and a doneness cue (e.g. "until golden, 5-7 minutes").',
      '- Finish with how to serve.',
      '',
      '"name" of the recipe is also in ' + language + '.',
    ].join('\n');

    const userPrompt = `Request: ${prompt}`;

    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new BadGatewayException(
        `AI assistant request failed (${res.status}): ${detail.slice(0, 300)}`,
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) {
      throw new BadGatewayException('AI assistant returned an empty response');
    }

    let parsed: {
      name?: string;
      ingredients?: ModelIngredient[];
      steps?: string[];
    };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      throw new BadGatewayException('AI assistant returned malformed JSON');
    }

    const ingredients = await Promise.all(
      (parsed.ingredients ?? [])
        .filter(
          (i) =>
            (i.name || i.searchName) &&
            Number.isFinite(i.amount) &&
            (i.amount as number) > 0,
        )
        .map(async (i) => {
          const match = await this.matchIngredient(i.searchName || i.name!, lang);
          return {
            ingredientId: match?.id ?? null,
            name: match?.name ?? i.name ?? i.searchName!,
            amount: Math.round(i.amount!),
          };
        }),
    );

    return {
      name: parsed.name?.trim() || 'AI-suggested recipe',
      ingredients,
      steps: (parsed.steps ?? [])
        .filter((stepText) => typeof stepText === 'string' && stepText.trim())
        .map((stepText, idx) => ({ stepNum: idx + 1, stepText: stepText.trim() })),
    };
  }

  // лучший кандидат в базе по английскому searchName ("olive oil" -> "Oil, olive, ..."); null — пусть юзер выберет сам
  private async matchIngredient(searchName: string, lang: string) {
    const [best] = await this.ingredientsService.search(searchName.toLowerCase(), lang, 1);
    return best ?? null;
  }
}
