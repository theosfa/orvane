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
});
