// Проверка цели по КБЖУ: модели плохо считают (и часто берут КБЖУ готового продукта вместо сырого),
// поэтому считаем сами по КБЖУ продуктов из базы и, если цель не выполнена, просим поправить граммовки.

export type ModelIngredient = {
  name?: string;
  searchName?: string;
  baseName?: string;
  amount?: number;
  per100g?: unknown;
};

export type TargetMode = 'about' | 'atLeast' | 'atMost';

export type RecipeTarget = {
  calories?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  mode?: TargetMode;
};

export type ModelRecipe = {
  name?: string;
  servings?: number;
  target?: RecipeTarget | null;
  ingredients?: ModelIngredient[];
  steps?: string[];
};

export type Metric = 'calories' | 'protein' | 'fat' | 'carbs';
export type Totals = Record<Metric, number>;
const METRICS: Metric[] = ['calories', 'protein', 'fat', 'carbs'];
const UNITS: Record<Metric, string> = { calories: 'kcal', protein: 'g protein', fat: 'g fat', carbs: 'g carbs' };

// допуск для "about": ±15% (в промпте просим ±10%, проверяем мягче, чтобы не гонять модель зря)
const TOLERANCE = 0.15;

const num = (v: unknown) => {
  const n = typeof v === 'string' ? Number(v) : v; // decimal из БД приходит строкой
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0;
};

// КБЖУ на порцию; per100g — в формате продукта из базы (caloriesPer100g, ...)
export function computeTotals(
  items: {
    amount: number;
    per100g: { caloriesPer100g: unknown; proteinPer100g: unknown; fatPer100g: unknown; carbsPer100g: unknown } | null;
  }[],
  servings: number,
): Totals {
  const s = Math.max(1, Math.round(num(servings)) || 1);
  const t: Totals = { calories: 0, protein: 0, fat: 0, carbs: 0 };
  for (const i of items) {
    if (!i.per100g) continue;
    const f = num(i.amount) / 100;
    t.calories += num(i.per100g.caloriesPer100g) * f;
    t.protein += num(i.per100g.proteinPer100g) * f;
    t.fat += num(i.per100g.fatPer100g) * f;
    t.carbs += num(i.per100g.carbsPer100g) * f;
  }
  for (const m of METRICS) t[m] /= s;
  return t;
}

// null — цели нет или она выполнена; иначе описание промаха для модели
export function checkTarget(target: RecipeTarget | null | undefined, totals: Totals): string | null {
  if (!target || typeof target !== 'object') return null;
  const mode: TargetMode =
    target.mode === 'atLeast' || target.mode === 'atMost' ? target.mode : 'about';

  const misses: string[] = [];
  for (const m of METRICS) {
    const want = target[m];
    if (typeof want !== 'number' || !Number.isFinite(want) || want <= 0) continue;
    const have = totals[m];
    const low = have < want * (1 - TOLERANCE);
    const high = have > want * (1 + TOLERANCE);
    const missed =
      (mode === 'about' && (low || high)) ||
      (mode === 'atLeast' && low) ||
      (mode === 'atMost' && high);
    if (missed) {
      const word = mode === 'atLeast' ? 'at least' : mode === 'atMost' ? 'at most' : 'about';
      misses.push(`${m}: ${Math.round(have)} instead of ${word} ${want} ${UNITS[m]} per serving`);
    }
  }
  return misses.length ? misses.join('; ') : null;
}
