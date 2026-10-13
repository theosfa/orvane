import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, registerUser } from './helpers';

describe('Tasks (e2e)', () => {
  let app: INestApplication;
  let auth: Record<string, string>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    ({ auth } = await registerUser(app));
  });

  it('accepts a task sent from another app and lists it for its week', async () => {
    const created = await http()
      .post('/tasks')
      .set(auth)
      .send({ title: ' Shopping list ', notes: 'Rice — 1000 g\nEgg — 250 g', date: '2026-10-15', source: 'food' })
      .expect(201);
    expect(created.body).toMatchObject({ title: 'Shopping list', date: '2026-10-15', done: false, source: 'food' });

    const week = await http().get('/tasks?from=2026-10-12').set(auth).expect(200);
    expect(week.body).toHaveLength(1);
    expect(week.body[0].notes).toBe('Rice — 1000 g\nEgg — 250 g');

    const other = await http().get('/tasks?from=2026-10-19').set(auth).expect(200);
    expect(other.body).toEqual([]);
  });

  it('defaults to a manual task and validates input', async () => {
    const res = await http().post('/tasks').set(auth).send({ title: 'Call mom', date: '2026-10-13' }).expect(201);
    expect(res.body.source).toBe('manual');
    await http().post('/tasks').set(auth).send({ title: '', date: '2026-10-13' }).expect(400);
    await http().post('/tasks').set(auth).send({ title: 'x', date: '2026-02-30' }).expect(400);
    await http().post('/tasks').set(auth).send({ title: 'x', date: '2026-10-13', source: 'spam' }).expect(400);
    await http().get('/tasks').set(auth).expect(400);
  });

  it('ticks, renames, moves and deletes a task', async () => {
    const { body: task } = await http().post('/tasks').set(auth).send({ title: 'Buy milk', date: '2026-10-13' }).expect(201);

    const done = await http().patch(`/tasks/${task.id}`).set(auth).send({ done: true }).expect(200);
    expect(done.body).toMatchObject({ done: true, title: 'Buy milk' });

    const moved = await http().patch(`/tasks/${task.id}`).set(auth).send({ title: 'Buy oat milk', date: '2026-10-20', done: false }).expect(200);
    expect(moved.body).toMatchObject({ title: 'Buy oat milk', date: '2026-10-20', done: false });
    expect((await http().get('/tasks?from=2026-10-12').set(auth)).body).toEqual([]);
    expect((await http().get('/tasks?from=2026-10-19').set(auth)).body).toHaveLength(1);

    await http().patch(`/tasks/${task.id}`).set(auth).send({ date: '2026-02-30' }).expect(400);
    await http().patch(`/tasks/${task.id}`).set(auth).send({ done: 'yes' }).expect(400);

    await http().delete(`/tasks/${task.id}`).set(auth).expect(200);
    await http().delete(`/tasks/${task.id}`).set(auth).expect(404);
  });

  it("cannot see or change another user's tasks", async () => {
    const { body: task } = await http().post('/tasks').set(auth).send({ title: 'Mine', date: '2026-10-13' }).expect(201);
    const other = await registerUser(app);
    expect((await http().get('/tasks?from=2026-10-12').set(other.auth)).body).toEqual([]);
    await http().patch(`/tasks/${task.id}`).set(other.auth).send({ done: true }).expect(404);
    await http().delete(`/tasks/${task.id}`).set(other.auth).expect(404);
  });

  it('lists a week ordered by day, then creation', async () => {
    for (const [title, date] of [['b', '2026-10-14'], ['a', '2026-10-12'], ['c', '2026-10-14'], ['out', '2026-10-19']]) {
      await http().post('/tasks').set(auth).send({ title, date }).expect(201);
    }
    const res = await http().get('/tasks?from=2026-10-12&to=2026-10-18').set(auth).expect(200);
    expect(res.body.map((t: { title: string }) => t.title)).toEqual(['a', 'b', 'c']);
  });
});
