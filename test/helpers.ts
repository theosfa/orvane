// test/helpers.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup-app';
import { DataSource } from 'typeorm';
import { Ingredient } from '../src/ingredients/ingredient.entity';
import { IngredientTranslation } from '../src/ingredients/ingredient-translation.entity';

export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

let counter = 0;

export const uniqueEmail = () => `user${Date.now()}_${counter++}@test.dev`;

// новый юзер на каждый тест — тесты не мешают друг другу
export async function registerUser(app: INestApplication, email = uniqueEmail()) {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password: 'password123' })
    .expect(201);
  const token: string = res.body.accessToken;
  return { email, token, auth: { Authorization: `Bearer ${token}` } };
}

let ingredientCounter = 0;

// продукт с английским названием прямо в базе — без DeepL
export async function seedIngredient(
  app: INestApplication,
  name: string,
  per100g = { calories: 100, protein: 10, fat: 5, carbs: 20 },
) {
  const ds = app.get(DataSource);
  const slug = `${name.toLowerCase().replace(/\W+/g, '-')}-${Date.now()}-${ingredientCounter++}`;
  const ingredient = await ds.getRepository(Ingredient).save({
    slug,
    caloriesPer100g: per100g.calories,
    proteinPer100g: per100g.protein,
    fatPer100g: per100g.fat,
    carbsPer100g: per100g.carbs,
  });
  await ds.getRepository(IngredientTranslation).save({
    ingredient,
    language: 'en',
    name,
  });
  return ingredient.id;
}

// рецепт на английском (lang=en), чтобы не было машинного перевода
export async function createRecipe(
  app: INestApplication,
  auth: Record<string, string>,
  body: Record<string, unknown>,
) {
  const res = await request(app.getHttpServer())
    .post('/recipes?lang=en')
    .set(auth)
    .send({ steps: [{ stepNum: 1, stepText: 'Cook.' }], ...body })
    .expect(201);
  return res.body;
}
