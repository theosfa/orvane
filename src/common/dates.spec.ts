import { addDays, isISODate, startOfWeek } from './dates';

describe('dates', () => {
  it('validates real calendar days', () => {
    expect(isISODate('2026-10-13')).toBe(true);
    expect(isISODate('2028-02-29')).toBe(true);
    expect(isISODate('2026-02-29')).toBe(false);
    expect(isISODate('2026-13-01')).toBe(false);
    expect(isISODate('13.10.2026')).toBe(false);
    expect(isISODate(undefined)).toBe(false);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('finds the Monday of the week', () => {
    expect(startOfWeek('2026-10-13')).toBe('2026-10-12');
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12');
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19');
    expect(startOfWeek('2027-01-01')).toBe('2026-12-28');
  });
});
