import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, createRecipe, registerUser, seedIngredient } from './helpers';

describe('Recipes servings (e2e)', () => {
  let app: INestApplication;
  let auth: Record<string, string>;
  let rice: number;

  beforeAll(async () => {
    app = await createApp();
    rice = await seedIngredient(app, 'Rice', { calories: 130, protein: 2.7, fat: 0.3, carbs: 28 });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    ({ auth } = await registerUser(app));
  });

  it('stores how many people a recipe is for', async () => {
    const created = await createRecipe(app, auth, {
      name: 'Rice bowl',
      servings: 4,
      ingredients: [{ ingredientId: rice, amount: 400 }],
    });
    expect(created.servings).toBe(4);

    const fetched = await request(app.getHttpServer())
      .get(`/recipes/${created.id}?lang=en`)
      .set(auth)
      .expect(200);
    expect(fetched.body).toMatchObject({ servings: 4, total: { calories: 520 } });

    const list = await request(app.getHttpServer()).get('/recipes?lang=en').set(auth).expect(200);
    expect(list.body.find((r: { id: number }) => r.id === created.id).servings).toBe(4);
  });

  it('defaults to one person', async () => {
    const created = await createRecipe(app, auth, {
      name: 'Plain rice',
      ingredients: [{ ingredientId: rice, amount: 100 }],
    });
    expect(created.servings).toBe(1);
  });

  it('rejects an invalid number of people', async () => {
    for (const servings of [0, 51, 2.5]) {
      await request(app.getHttpServer())
        .post('/recipes?lang=en')
        .set(auth)
        .send({ name: 'x', servings, ingredients: [], steps: [] })
        .expect(400);
    }
  });
});
