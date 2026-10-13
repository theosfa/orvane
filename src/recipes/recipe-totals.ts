// recipes/recipe-totals.ts — КБЖУ рецепта, общий для рецептов и меню
import { Recipe } from './recipe.entity';

export type Totals = { calories: number; protein: number; fat: number; carbs: number };

export const emptyTotals = (): Totals => ({ calories: 0, protein: 0, fat: 0, carbs: 0 });

export function addTotals(a: Totals, b: Totals): Totals {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    carbs: a.carbs + b.carbs,
  };
}

export function roundTotals(t: Totals): Totals {
  return {
    calories: +t.calories.toFixed(2),
    protein: +t.protein.toFixed(2),
    fat: +t.fat.toFixed(2),
    carbs: +t.carbs.toFixed(2),
  };
}

// рецепт с загруженными ingredients->ingredient — считаем КБЖУ на весь рецепт
export function computeRecipeTotals(recipe: Recipe): Totals {
  let totals = emptyTotals();
  for (const ri of recipe.ingredients ?? []) {
    const factor = Number(ri.amount) / 100;
    totals = addTotals(totals, {
      calories: Number(ri.ingredient.caloriesPer100g) * factor,
      protein: Number(ri.ingredient.proteinPer100g) * factor,
      fat: Number(ri.ingredient.fatPer100g) * factor,
      carbs: Number(ri.ingredient.carbsPer100g) * factor,
    });
  }
  return totals;
}
