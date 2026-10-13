// scripts/test-deepl.ts
import * as deepl from 'deepl-node';
import { config } from 'dotenv';
config();

async function test() {
  const translator = new deepl.Translator(process.env.DEEPL_API_KEY!);
  const result = await translator.translateText(
    'Raw grape tomatoes',
    'en',
    'ru',
  );
  console.log(result.text); // ожидаем: Картофель
}

test();
