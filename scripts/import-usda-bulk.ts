// scripts/import-usda-bulk.ts
import * as fs from 'fs';
import { config } from 'dotenv';
import { AppDataSource } from '../src/data-source';
import { Ingredient } from '../src/ingredients/ingredient.entity';
import { IngredientTranslation } from '../src/ingredients/ingredient-translation.entity';

config();

interface UsdaNutrient {
  nutrient: { name: string; unitName: string };
  amount: number;
}

interface UsdaFood {
  fdcId: number;
  description: string;
  foodCategory?: { description: string };
  foodNutrients: UsdaNutrient[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/,.*$/, '') // убрать всё после запятой ("Potato, raw" -> "Potato")
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractNutrient(
  food: UsdaFood,
  name: string,
  unit: string,
): number | null {
  const found = food.foodNutrients.find(
    (n) =>
      n.nutrient?.name?.toLowerCase().includes(name.toLowerCase()) &&
      n.nutrient?.unitName?.toLowerCase() === unit.toLowerCase(),
  );
  return found ? found.amount : null;
}

function parseCpf(food: UsdaFood) {
  const calories = extractNutrient(food, 'Energy', 'kcal');
  const protein = extractNutrient(food, 'Protein', 'g');
  const fat = extractNutrient(food, 'Total lipid', 'g');
  const carbs = extractNutrient(food, 'Carbohydrate, by difference', 'g');

  if (calories === null) return null;

  return {
    caloriesPer100g: calories,
    proteinPer100g: protein ?? 0,
    fatPer100g: fat ?? 0,
    carbsPer100g: carbs ?? 0,
  };
}

async function importFile(filePath: string, foodsKey: string) {
  console.log(`Reading ${filePath}...`);
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const foods: UsdaFood[] = raw[foodsKey];
  console.log(`Found ${foods.length} items`);

  const ingredientRepo = AppDataSource.getRepository(Ingredient);
  const translationRepo = AppDataSource.getRepository(IngredientTranslation);

  let saved = 0;
  let skipped = 0;

  for (const food of foods) {
    const slug = slugify(food.description);
    if (!slug) {
      skipped++;
      continue;
    }

    const existing = await ingredientRepo.findOne({ where: { slug } });
    if (existing) {
      skipped++;
      continue;
    }

    const cpf = parseCpf(food);
    if (!cpf) {
      skipped++;
      continue;
    }

    const ingredient = ingredientRepo.create({ slug, ...cpf });
    await ingredientRepo.save(ingredient);

    await translationRepo.save(
      translationRepo.create({
        ingredient,
        language: 'en',
        name: food.description,
      }),
    );

    saved++;
    if (saved % 50 === 0) console.log(`  ...${saved} saved so far`);
  }

  console.log(`Done: ${saved} saved, ${skipped} skipped`);
}

async function run() {
  await AppDataSource.initialize();

  await importFile(
    'data/usda/FF.json',
    'FoundationFoods',
  );
  await importFile(
    'data/usda/FDC_sr.json',
    'SRLegacyFoods',
  );

  await AppDataSource.destroy();
}

run();
