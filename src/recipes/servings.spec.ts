import { clampServings, scaleAmount } from './servings';

describe('scaleAmount', () => {
  it('scales proportionally to the number of people', () => {
    expect(scaleAmount(200, 2, 4)).toBe(400);
    expect(scaleAmount(200, 4, 1)).toBe(50);
    expect(scaleAmount(100, 3, 2)).toBe(66.67);
  });

  it('keeps the amount for the same count and handles decimal strings', () => {
    expect(scaleAmount(150.5, 2, 2)).toBe(150.5);
    expect(scaleAmount('120.00' as unknown as number, 2, 3)).toBe(180);
  });
});

describe('clampServings', () => {
  it('turns whatever the model returned into 1..50', () => {
    expect(clampServings(4)).toBe(4);
    expect(clampServings('3')).toBe(3);
    expect(clampServings(2.6)).toBe(3);
    expect(clampServings(undefined)).toBe(2);
    expect(clampServings(0)).toBe(2);
    expect(clampServings('many')).toBe(2);
    expect(clampServings(500)).toBe(50);
  });
});
