import { checkTarget, computeTotals } from './recipe-target';

const CHICKEN = { caloriesPer100g: '120.00', proteinPer100g: '22.50', fatPer100g: '2.60', carbsPer100g: '0.00' };
const RICE = { caloriesPer100g: 365, proteinPer100g: 7.1, fatPer100g: 0.7, carbsPer100g: 80 };

describe('computeTotals', () => {
  it('sums per serving, accepts decimal strings from the DB', () => {
    const t = computeTotals(
      [
        { amount: 400, per100g: CHICKEN },
        { amount: 200, per100g: RICE },
      ],
      2,
    );
    expect(t.protein).toBeCloseTo((90 + 14.2) / 2, 1);
    expect(t.calories).toBeCloseTo((480 + 730) / 2, 1);
  });

  it('skips unknown products and treats bad servings as 1', () => {
    const t = computeTotals([{ amount: 100, per100g: CHICKEN }, { amount: 50, per100g: null }], 0);
    expect(t.protein).toBeCloseTo(22.5, 1);
  });
});

describe('checkTarget', () => {
  const totals = { calories: 845, protein: 97.1, fat: 11.1, carbs: 80 };

  it('passes without a target', () => {
    expect(checkTarget(null, totals)).toBeNull();
    expect(checkTarget(undefined, totals)).toBeNull();
  });

  it('flags a missed "about" target', () => {
    expect(checkTarget({ protein: 150, mode: 'about' }, totals)).toContain('protein: 97 instead of about 150');
    expect(checkTarget({ protein: 150 }, totals)).toContain('about 150');
  });

  it('accepts a met target within tolerance', () => {
    expect(checkTarget({ protein: 105 }, totals)).toBeNull();
  });

  it('respects atMost / atLeast', () => {
    expect(checkTarget({ calories: 2000, mode: 'atMost' }, totals)).toBeNull();
    expect(checkTarget({ calories: 500, mode: 'atMost' }, totals)).toContain('at most 500');
    expect(checkTarget({ protein: 50, mode: 'atLeast' }, totals)).toBeNull();
  });
});
