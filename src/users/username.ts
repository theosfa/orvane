// users/username.ts — ник: 3–30 символов, латиница в нижнем регистре, цифры, _ и .
export const USERNAME_RE = /^[a-z0-9_.]{3,30}$/;

// заготовка ника из email (до @); уникальность добавляет UsersService
export function usernameBase(email: string): string {
  const base = (email.split('@')[0] ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 24);
  return base.length >= 3 ? base : `${base}user`.slice(0, 24);
}

// base, base1, base2, … — первый свободный
export function firstFreeUsername(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 1; ; n++) {
    const candidate = `${base}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
