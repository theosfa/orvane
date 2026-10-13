// scripts/translate-all.ts
// Переводит английские названия всех продуктов на язык(и), которых ещё нет в базе.
// Usage: npx ts-node scripts/translate-all.ts pl fr
import { config } from 'dotenv';
import * as deepl from 'deepl-node';
import { AppDataSource } from '../src/data-source';
import { Ingredient } from '../src/ingredients/ingredient.entity';
import { IngredientTranslation } from '../src/ingredients/ingredient-translation.entity';

config();

const TARGET_LANGS = process.argv.slice(2);
const BATCH_SIZE = 50; // максимум текстов в одном запросе DeepL

if (!TARGET_LANGS.length) {
  console.error('Usage: ts-node translate-all.ts <lang_code> [<lang_code> ...]');
  process.exit(1);
}

async function run() {
  await AppDataSource.initialize();

  const translator = new deepl.Translator(process.env.DEEPL_API_KEY!);
  const ingredientRepo = AppDataSource.getRepository(Ingredient);
  const translationRepo = AppDataSource.getRepository(IngredientTranslation);

  const ingredients = await ingredientRepo.find({
    relations: { translations: true },
  });
  console.log(`Total ingredients: ${ingredients.length}`);

  for (const lang of TARGET_LANGS) {
    const todo = ingredients
      .filter((ing) => !ing.translations.some((t) => t.language === lang))
      .map((ing) => ({ ing, en: ing.translations.find((t) => t.language === 'en')?.name }))
      .filter((x): x is { ing: Ingredient; en: string } => {
        if (!x.en) console.warn(`No English name for ingredient id=${x.ing.id}, skipping`);
        return !!x.en;
      });

    let translated = 0;
    let failed = 0;
    for (let i = 0; i < todo.length; i += BATCH_SIZE) {
      const batch = todo.slice(i, i + BATCH_SIZE);
      try {
        const results = await translator.translateText(
          batch.map((x) => x.en),
          'en',
          (lang === 'en' ? 'en-US' : lang) as deepl.TargetLanguageCode,
        );
        await translationRepo
          .createQueryBuilder()
          .insert()
          .values(batch.map((x, j) => ({ ingredient: x.ing, language: lang, name: results[j].text })))
          .orIgnore()
          .execute();
        translated += batch.length;
        console.log(`  [${lang}] ${translated}/${todo.length}`);
      } catch (e: any) {
        failed += batch.length;
        console.error(`  [${lang}] batch at ${i} failed:`, e.message);
      }
    }
    console.log(`Done "${lang}": ${translated} translated, ${failed} failed`);
  }

  await AppDataSource.destroy();
}

run();
