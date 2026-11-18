import { ingredientKey, sanitizeNutrition } from './ingredient-name';

describe('ingredientKey', () => {
  it('normalizes plurals, case and descriptors', () => {
    expect(ingredientKey('Tomatoes')).toBe('tomato');
    expect(ingredientKey('fresh tomato')).toBe('tomato');
    expect(ingredientKey('Green peas')).toBe(ingredientKey('green pea'));
    expect(ingredientKey('Raspberries')).toBe('raspberry');
    expect(ingredientKey('extra virgin olive oil')).toBe('olive-oil');
    expect(ingredientKey('Chicken breast, boneless skinless')).toBe('chicken-breast');
  });

  it('keeps different products apart', () => {
    expect(ingredientKey('egg')).not.toBe(ingredientKey('eggplant'));
    expect(ingredientKey('cream')).not.toBe(ingredientKey('sour cream'));
    expect(ingredientKey('Glass')).toBe('glass');
    expect(ingredientKey('buckwheat groats')).toBe('buckwheat');
    expect(ingredientKey('ground beef')).not.toBe(ingredientKey('beef'));
  });

  it('works for non-latin names', () => {
    expect(ingredientKey('Свежий укроп')).toBe('свежий-укроп');
  });
});

describe('sanitizeNutrition', () => {
  it('accepts valid values', () => {
    expect(sanitizeNutrition({ calories: 40, protein: 1.1, fat: 0.1, carbs: 9.3 })).toEqual({
      caloriesPer100g: 40,
      proteinPer100g: 1.1,
      fatPer100g: 0.1,
      carbsPer100g: 9.3,
    });
  });

  it('rejects missing macros and computes missing calories', () => {
    expect(sanitizeNutrition({ calories: 40 })).toBeNull();
    expect(sanitizeNutrition(null)).toBeNull();
    expect(sanitizeNutrition({ protein: 10, fat: 10, carbs: 10 })?.caloriesPer100g).toBe(170);
  });

  it('clamps impossible values', () => {
    const n = sanitizeNutrition({ calories: 5000, protein: 80, fat: 80, carbs: 40 })!;
    expect(n.caloriesPer100g).toBe(900);
    expect(n.proteinPer100g + n.fatPer100g + n.carbsPer100g).toBeCloseTo(100, 1);
  });
});
