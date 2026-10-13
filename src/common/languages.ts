// common/languages.ts
// единый список языков приложения — его же повторяет фронт (orvane-front/i18n/languages.ts)
export const SUPPORTED_LANGUAGES = ['ru', 'en', 'pl', 'fr', 'uk'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';

export function isLanguage(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language);
}

// неизвестный / пустой код -> язык по умолчанию
export function toLanguage(value: unknown): Language {
  return isLanguage(value) ? value : DEFAULT_LANGUAGE;
}
