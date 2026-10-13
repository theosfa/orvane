// scripts/seed-ingredients.ts
import axios from 'axios';
import { AppDataSource } from '../src/data-source';
import { Ingredient } from '../src/ingredients/ingredient.entity';
import { IngredientTranslation } from '../src/ingredients/ingredient-translation.entity';

const USDA_API_KEY = process.env.USDA_API_KEY;

const INGREDIENTS = [
  { slug: 'potato', en: 'Potato', ru: 'Картофель' },
  { slug: 'tomato', en: 'Tomato', ru: 'Помидор' },
  { slug: 'onion', en: 'Onion', ru: 'Лук' },
];

async function fetchCpf(slug: string) {
  const { data } = await axios.get(
    'https://api.nal.usda.gov/fdc/v1/foods/search',
    {
      params: {
        query: slug,
        api_key: USDA_API_KEY,
        dataType: 'Foundation,SR Legacy',
        pageSize: 1,
      },
    },
  );

  const food = data.foods?.[0];
  if (!food) throw new Error(`Not found in USDA: ${slug}`);

  const get = (name: string, unit: string) =>
    food.foodNutrients.find(
      (n: any) => n.nutrientName.includes(name) && n.unitName === unit,
    )?.value ?? 0;

  return {
    caloriesPer100g: get('Energy', 'KCAL'),
    proteinPer100g: get('Protein', 'G'),
    fatPer100g: get('Total lipid', 'G'),
    carbsPer100g: get('Carbohydrate', 'G'),
  };
}

async function seed() {
  await AppDataSource.initialize();
  const ingredientRepo = AppDataSource.getRepository(Ingredient);
  const translationRepo = AppDataSource.getRepository(IngredientTranslation);

  for (const item of INGREDIENTS) {
    try {
      const cpf = await fetchCpf(item.slug);
      const ingredient = ingredientRepo.create({ slug: item.slug, ...cpf });
      await ingredientRepo.save(ingredient);

      await translationRepo.save([
        translationRepo.create({ ingredient, language: 'en', name: item.en }),
        translationRepo.create({ ingredient, language: 'ru', name: item.ru }),
      ]);

      console.log(`Saved: ${item.slug}`);
    } catch (e) {
      console.error(`Failed: ${item.slug}`, e.message);
    }
  }

  await AppDataSource.destroy();
}

seed();
