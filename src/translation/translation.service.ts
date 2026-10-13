// translation/translation.service.ts
import { Injectable } from '@nestjs/common';
import * as deepl from 'deepl-node';

// DeepL принимает до 50 текстов за один запрос
const BATCH_SIZE = 50;

@Injectable()
export class TranslationService {
  private translator: deepl.Translator;

  constructor() {
    this.translator = new deepl.Translator(process.env.DEEPL_API_KEY!);
  }

  async translate(
    text: string,
    targetLang: string,
    sourceLang: string | null = 'en',
  ): Promise<string> {
    const [result] = await this.translateMany([text], targetLang, sourceLang);
    return result;
  }

  // перевод пачкой, порядок сохраняется; sourceLang = null — DeepL сам определит язык
  // (юзер мог написать рецепт не на языке интерфейса)
  async translateMany(
    texts: string[],
    targetLang: string,
    sourceLang: string | null = null,
  ): Promise<string[]> {
    const out: string[] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const results = await this.translator.translateText(
        batch,
        sourceLang as deepl.SourceLanguageCode | null,
        this.toDeeplTargetLang(targetLang),
      );
      out.push(...results.map((r) => r.text));
    }
    return out;
  }

  private toDeeplTargetLang(lang: string): deepl.TargetLanguageCode {
    // для некоторых языков DeepL требует региональный вариант как ЦЕЛЕВОЙ (en -> en-US, pt -> pt-PT)
    const targetMap: Record<string, deepl.TargetLanguageCode> = {
      en: 'en-US',
      pt: 'pt-PT',
    };
    return targetMap[lang] || (lang as deepl.TargetLanguageCode);
  }
}
