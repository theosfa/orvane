// recipes/servings.ts — пересчёт количеств рецепта на другое число человек
export const MAX_SERVINGS = 50;

// amount рассчитан на `from` человек — сколько нужно на `to`
export function scaleAmount(amount: number, from: number, to: number): number {
  if (!from || from === to) return +Number(amount).toFixed(2);
  return +((Number(amount) * to) / from).toFixed(2);
}

// модель ИИ может вернуть что угодно — приводим к целому 1..MAX_SERVINGS, по умолчанию 2
export function clampServings(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return 2;
  return Math.min(n, MAX_SERVINGS);
}
