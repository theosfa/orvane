import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, createRecipe, registerUser, seedIngredient } from './helpers';

describe('Menu (e2e)', () => {
  let app: INestApplication;
  let auth: Record<string, string>;
  let rice: number;
  let egg: number;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
    rice = await seedIngredient(app, 'Rice', { calories: 100, protein: 2, fat: 0, carbs: 20 });
    egg = await seedIngredient(app, 'Egg', { calories: 150, protein: 12, fat: 10, carbs: 1 });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    ({ auth } = await registerUser(app));
  });

  // рецепт на 2 человек: 400 г риса + 100 г яиц = 400 + 150 = 550 ккал, 275 на человека
  const likedRecipe = async (name = 'Fried rice') => {
    const r = await createRecipe(app, auth, {
      name,
      servings: 2,
      ingredients: [
        { ingredientId: rice, amount: 400 },
        { ingredientId: egg, amount: 100 },
      ],
    });
    await http().post(`/recipes/${r.id}/like`).set(auth).expect(201);
    return r.id as number;
  };

  const add = (body: Record<string, unknown>) =>
    http().post('/menu').set(auth).send({ mealType: 'dinner', servings: 1, ...body });

  it('only accepts liked recipes', async () => {
    const notLiked = await createRecipe(app, auth, {
      name: 'Plain',
      ingredients: [{ ingredientId: rice, amount: 100 }],
    });
    const res = await add({ date: '2026-10-12', recipeId: notLiked.id }).expect(400);
    expect(res.body.message).toMatch(/liked/);

    const liked = await likedRecipe();
    await add({ date: '2026-10-12', recipeId: liked }).expect(201);

    // unliking later doesn't remove it, but it can no longer be added
    await http().delete(`/recipes/${liked}/like`).set(auth).expect(200);
    await add({ date: '2026-10-13', recipeId: liked }).expect(400);
  });

  it('returns the week of any given day with dates and per-person calories', async () => {
    const id = await likedRecipe();
    await add({ date: '2026-10-14', recipeId: id, servings: 3, mealType: 'dinner' }).expect(201);
    await add({ date: '2026-10-14', recipeId: id, servings: 1, mealType: 'breakfast' }).expect(201);
    await add({ date: '2026-10-19', recipeId: id }).expect(201); // next week

    const res = await http().get('/menu?week=2026-10-16&lang=en').set(auth).expect(200);
    expect(res.body.weekStart).toBe('2026-10-12');
    expect(res.body.days.map((d: { date: string }) => d.date)).toEqual([
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18',
    ]);
    const wed = res.body.days[2];
    // breakfast first, then dinner
    expect(wed.meals.map((m: { mealType: string }) => m.mealType)).toEqual(['breakfast', 'dinner']);
    expect(wed.meals[1]).toMatchObject({ recipeName: 'Fried rice', servings: 3, calories: 275 });
    expect(wed.total.calories).toBe(550);
    expect(res.body.weekTotal.calories).toBe(550);

    const next = await http().get('/menu?week=2026-10-19&lang=en').set(auth).expect(200);
    expect(next.body.days[0].meals).toHaveLength(1);

    // previous weeks are just as reachable
    const prev = await http().get('/menu?week=2026-10-05&lang=en').set(auth).expect(200);
    expect(prev.body.weekStart).toBe('2026-10-05');
  });

  it('validates date, meal type and servings 1..12', async () => {
    const id = await likedRecipe();
    await add({ date: '2026-02-30', recipeId: id }).expect(400);
    await add({ date: '2026-10-12', recipeId: id, mealType: 'brunch' }).expect(400);
    await add({ date: '2026-10-12', recipeId: id, servings: 0 }).expect(400);
    await add({ date: '2026-10-12', recipeId: id, servings: 13 }).expect(400);
    await add({ date: '2026-10-12', recipeId: id, servings: 12 }).expect(201);
    await http().get('/menu?week=soon').set(auth).expect(400);
  });

  it('replaces a whole day at once', async () => {
    const a = await likedRecipe('A');
    const b = await likedRecipe('B');
    await add({ date: '2026-10-12', recipeId: a }).expect(201);
    await add({ date: '2026-10-13', recipeId: a }).expect(201);

    await http()
      .put('/menu/days/2026-10-12')
      .set(auth)
      .send({ meals: [
        { mealType: 'lunch', recipeId: b, servings: 2 },
        { mealType: 'dinner', recipeId: a, servings: 4 },
      ] })
      .expect(200);

    const week = (await http().get('/menu?week=2026-10-12&lang=en').set(auth)).body;
    expect(week.days[0].meals.map((m: { recipeName: string; servings: number }) => [m.recipeName, m.servings])).toEqual([
      ['B', 2],
      ['A', 4],
    ]);
    expect(week.days[1].meals).toHaveLength(1); // other days untouched

    // a not-liked recipe aborts the whole save — the day stays as it was
    const other = await createRecipe(app, auth, { name: 'C', ingredients: [] });
    await http()
      .put('/menu/days/2026-10-12')
      .set(auth)
      .send({ meals: [{ mealType: 'lunch', recipeId: other.id, servings: 1 }] })
      .expect(400);
    const again = (await http().get('/menu?week=2026-10-12&lang=en').set(auth)).body;
    expect(again.days[0].meals).toHaveLength(2);

    // empty list clears the day
    await http().put('/menu/days/2026-10-12').set(auth).send({ meals: [] }).expect(200);
    const cleared = (await http().get('/menu?week=2026-10-12&lang=en').set(auth)).body;
    expect(cleared.days[0].meals).toEqual([]);
  });

  it('removes a single entry, only your own', async () => {
    const id = await likedRecipe();
    const { body } = await add({ date: '2026-10-12', recipeId: id }).expect(201);
    const other = await registerUser(app);
    await http().delete(`/menu/${body.id}`).set(other.auth).expect(404);
    await http().delete(`/menu/${body.id}`).set(auth).expect(200);
  });

  it('builds a shopping list for chosen days, scaled to the people per meal', async () => {
    const id = await likedRecipe(); // 400 g rice + 100 g egg for 2 people
    await add({ date: '2026-10-12', recipeId: id, servings: 4 }).expect(201); // x2
    await add({ date: '2026-10-13', recipeId: id, servings: 1 }).expect(201); // x0.5
    await add({ date: '2026-10-14', recipeId: id, servings: 2 }).expect(201); // not chosen

    const res = await http()
      .get('/menu/shopping-list?dates=2026-10-12,2026-10-13&lang=en')
      .set(auth)
      .expect(200);
    expect(res.body).toEqual([
      { ingredientId: egg, name: 'Egg', amount: 250 },
      { ingredientId: rice, name: 'Rice', amount: 1000 },
    ]);

    await http().get('/menu/shopping-list').set(auth).expect(400);
    await http().get('/menu/shopping-list?dates=yesterday').set(auth).expect(400);
  });
});
