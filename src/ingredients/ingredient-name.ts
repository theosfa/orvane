// Нормализация английских названий продуктов для сопоставления AI-рецептов с базой:
// "Fresh Tomatoes" и "tomato" -> "tomato", "extra virgin olive oil" -> "olive-oil".
// Сравниваются ключи целиком, без подстрок — чтобы "egg" не совпал с "eggplant", а "cream" с "sour cream".

// слова, которые не меняют сам продукт (размер, свежесть, нарезка)
const DESCRIPTORS = new Set([
  'fresh', 'raw', 'large', 'small', 'medium', 'big', 'ripe', 'whole', 'organic',
  'boneless', 'skinless', 'extra', 'virgin', 'chopped', 'sliced', 'diced', 'minced',
  'peeled', 'grated', 'shredded', 'crushed', 'finely', 'roughly', 'of', 'a', 'the',
  'groats', // buckwheat groats = buckwheat
]);

function singular(word: string): string {
  if (word.length <= 3 || word.endsWith('ss')) return word;
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y'; // berries -> berry
  if (word.endsWith('oes')) return word.slice(0, -2); // tomatoes -> tomato
  if (/(ches|shes|xes|sses)$/.test(word)) return word.slice(0, -2); // radishes -> radish
  if (word.endsWith('s')) return word.slice(0, -1); // carrots -> carrot
  return word;
}

export function ingredientKey(name: string): string {
  const words = name
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const meaningful = words.filter((w) => !DESCRIPTORS.has(w));
  return (meaningful.length ? meaningful : words).map(singular).join('-');
}

export type Nutrition = {
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

// КБЖУ от модели: отбрасываем мусор, обрезаем до физически возможных значений;
// null — данных нет, продукт создавать нельзя
export function sanitizeNutrition(raw: unknown): Nutrition | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => {
    const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
  };
  let protein = num(r.protein);
  let fat = num(r.fat);
  let carbs = num(r.carbs);
  let calories = num(r.calories);
  if (protein === null || fat === null || carbs === null) return null;

  protein = Math.min(protein, 100);
  fat = Math.min(fat, 100);
  carbs = Math.min(carbs, 100);
  const sum = protein + fat + carbs;
  if (sum > 100) {
    // в 100 г не может быть больше 100 г БЖУ — пропорционально ужимаем
    protein = (protein * 100) / sum;
    fat = (fat * 100) / sum;
    carbs = (carbs * 100) / sum;
  }
  if (calories === null) calories = protein * 4 + fat * 9 + carbs * 4;
  calories = Math.min(calories, 900);

  return {
    caloriesPer100g: round2(calories),
    proteinPer100g: round2(protein),
    fatPer100g: round2(fat),
    carbsPer100g: round2(carbs),
  };
}
