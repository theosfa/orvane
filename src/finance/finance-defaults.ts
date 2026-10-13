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

export function defaultCategories(lang: Language): { name: string; type: TransactionType }[] {
  const d = FINANCE_DEFAULTS[lang];
  return [
    ...d.expense.map((name) => ({ name, type: 'expense' as const })),
    ...d.income.map((name) => ({ name, type: 'income' as const })),
  ];
}
