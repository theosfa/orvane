// finance/finance-defaults.ts — стандартные категории и первый кошелёк, создаются на языке юзера
import type { Language } from '../common/languages';
import type { TransactionType } from './finance-types';

type Defaults = {
  wallet: string;
  expense: string[];
  income: string[];
};

export const FINANCE_DEFAULTS: Record<Language, Defaults> = {
  en: {
    wallet: 'Cash',
    expense: ['Cafe', 'Coffee', 'Groceries', 'Supplies', 'Transport', 'Home', 'Health', 'Entertainment'],
    income: ['Salary', 'Side jobs', 'Gifts'],
  },
  ru: {
    wallet: 'Наличные',
    expense: ['Кафе', 'Кофе', 'Продукты', 'Хозтовары', 'Транспорт', 'Дом', 'Здоровье', 'Развлечения'],
    income: ['Зарплата', 'Подработка', 'Подарки'],
  },
  uk: {
    wallet: 'Готівка',
    expense: ['Кафе', 'Кава', 'Продукти', 'Господарські товари', 'Транспорт', 'Дім', "Здоров'я", 'Розваги'],
    income: ['Зарплата', 'Підробіток', 'Подарунки'],
  },
  pl: {
    wallet: 'Gotówka',
    expense: ['Kawiarnia', 'Kawa', 'Spożywcze', 'Artykuły', 'Transport', 'Dom', 'Zdrowie', 'Rozrywka'],
    income: ['Wynagrodzenie', 'Zlecenia', 'Prezenty'],
  },
  fr: {
    wallet: 'Espèces',
    expense: ['Bistrot', 'Café', 'Courses', 'Fournitures', 'Transport', 'Maison', 'Santé', 'Loisirs'],
    income: ['Salaire', 'Petits boulots', 'Cadeaux'],
  },
};

// постоянные ключи стандартных категорий — в том же порядке, что и названия выше.
// Ключ остаётся при переименовании, по нему приложения находят «свою» категорию
// (например, список покупок из меню — «groceries»)
export const DEFAULT_CATEGORY_KEYS = {
  expense: ['cafe', 'coffee', 'groceries', 'supplies', 'transport', 'home', 'health', 'entertainment'],
  income: ['salary', 'side_jobs', 'gifts'],
} as const;

export function defaultCategories(
  lang: Language,
): { name: string; type: TransactionType; key: string }[] {
  const d = FINANCE_DEFAULTS[lang];
  return [
    ...d.expense.map((name, i) => ({ name, type: 'expense' as const, key: DEFAULT_CATEGORY_KEYS.expense[i] })),
    ...d.income.map((name, i) => ({ name, type: 'income' as const, key: DEFAULT_CATEGORY_KEYS.income[i] })),
  ];
}
