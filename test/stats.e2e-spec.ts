import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, createRecipe, registerUser, seedIngredient } from './helpers';

describe('Stats (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('starts at zero', async () => {
    const u = await registerUser(app);
    const { body } = await http().get('/stats').set(u.auth).expect(200);
    expect(body).toEqual({ recipesWritten: 0, recipesLiked: 0, weeksPlanned: 0, tasksDone: 0 });
  });

  it('counts the user’s own recipes, likes, planned weeks and finished tasks — not anyone else’s', async () => {
    const u = await registerUser(app);
    const other = await registerUser(app);
    const rice = await seedIngredient(app, 'Rice');
    const mine = await createRecipe(app, u.auth, { name: 'Fried rice', ingredients: [{ ingredientId: rice, amount: 100 }] });
    await createRecipe(app, other.auth, { name: 'Other rice', ingredients: [{ ingredientId: rice, amount: 100 }] });
    await http().post(`/recipes/${mine.id}/like`).set(u.auth).expect(201);

    // Mon + Sun of one week, and a day of the next week → 2 weeks
    for (const date of ['2026-10-12', '2026-10-18', '2026-10-19']) {
      await http().post('/menu').set(u.auth).send({ date, recipeId: mine.id, mealType: 'dinner', servings: 1 }).expect(201);
    }

    const done = await http().post('/tasks').set(u.auth).send({ title: 'Shop', date: '2026-10-14' }).expect(201);
    await http().patch(`/tasks/${done.body.id}`).set(u.auth).send({ done: true }).expect(200);
    await http().post('/tasks').set(u.auth).send({ title: 'Later', date: '2026-10-15' }).expect(201);

    const { body } = await http().get('/stats').set(u.auth).expect(200);
    expect(body).toEqual({ recipesWritten: 1, recipesLiked: 1, weeksPlanned: 2, tasksDone: 1 });
  });

  it('needs a signed-in user', async () => {
    await http().get('/stats').expect(401);
  });
});
