import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Subscription } from 'rxjs';
import { createApp, registerUser } from './helpers';
import {
  FamilyEventsService,
  LiveMessage,
} from '../src/family/family-events.service';

type User = Awaited<ReturnType<typeof registerUser>>;

describe('Family live updates (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const subs: Subscription[] = [];

  beforeAll(async () => {
    app = await createApp();
  });

  afterEach(() => subs.splice(0).forEach((s) => s.unsubscribe()));

  afterAll(async () => {
    await app.close();
  });

  const userIdOf = async (u: User) =>
    (await http().get('/auth/profile').set(u.auth)).body.user.id as number;

  // events a user's stream receives, without the pings
  async function listen(u: User) {
    const got: LiveMessage['data'][] = [];
    const sub = app
      .get(FamilyEventsService)
      .stream(await userIdOf(u))
      .subscribe((m) => m.data.topic !== 'ping' && got.push(m.data));
    subs.push(sub);
    return got;
  }

  // notifications go out right after the response; give them a moment
  const settle = () => new Promise((r) => setTimeout(r, 100));

  async function family() {
    const admin = await registerUser(app);
    const member = await registerUser(app);
    await http()
      .post('/family?lang=en')
      .set(admin.auth)
      .send({ name: 'Smiths' })
      .expect(201);
    await http()
      .post('/family/invites')
      .set(admin.auth)
      .send({ email: member.email })
      .expect(201);
    const { body } = await http().get('/family').set(member.auth);
    await http()
      .post(`/family/invitations/${body.invitations[0].id}/accept`)
      .set(member.auth)
      .expect(201);
    return { admin, member };
  }

  it('tells every member when family data changes, with the tab that changed it', async () => {
    const { admin, member } = await family();
    const memberGot = await listen(member);
    const adminGot = await listen(admin);

    await http()
      .post('/tasks?scope=family')
      .set(admin.auth)
      .set('X-Client-Id', 'tab-1')
      .send({ title: 'Buy milk', date: '2026-10-14' })
      .expect(201);
    await settle();

    expect(memberGot).toEqual([{ topic: 'tasks', origin: 'tab-1' }]);
    expect(adminGot).toEqual([{ topic: 'tasks', origin: 'tab-1' }]);
  });

  it('stays quiet about personal data and failed changes', async () => {
    const { admin, member } = await family();
    const memberGot = await listen(member);

    await http()
      .post('/tasks')
      .set(admin.auth)
      .send({ title: 'Mine', date: '2026-10-14' })
      .expect(201);
    // members can't change family data
    await http()
      .post('/tasks?scope=family')
      .set(member.auth)
      .send({ title: 'No', date: '2026-10-14' })
      .expect(403);
    await settle();

    expect(memberGot).toEqual([]);
  });

  it('tells the invited user and the family about invites, and a removed member', async () => {
    const admin = await registerUser(app);
    const guest = await registerUser(app);
    await http()
      .post('/family?lang=en')
      .set(admin.auth)
      .send({ name: 'Smiths' })
      .expect(201);
    const guestGot = await listen(guest);

    await http()
      .post('/family/invites')
      .set(admin.auth)
      .send({ email: guest.email })
      .expect(201);
    await settle();
    expect(guestGot).toEqual([{ topic: 'family', origin: null }]);

    const adminGot = await listen(admin);
    const { body } = await http().get('/family').set(guest.auth);
    await http()
      .post(`/family/invitations/${body.invitations[0].id}/accept`)
      .set(guest.auth)
      .expect(201);
    await settle();
    expect(adminGot).toEqual([{ topic: 'family', origin: null }]);

    await http()
      .delete(`/family/members/${await userIdOf(guest)}`)
      .set(admin.auth)
      .expect(200);
    await settle();
    expect(guestGot).toHaveLength(3); // invite, own accept, removal
  });

  it('serves the stream as server-sent events to a signed-in user only', async () => {
    await http().get('/family/events').expect(401);

    const u = await registerUser(app);
    await app.listen(0);
    const { port } = app.getHttpServer().address();
    const ctrl = new AbortController();
    const res = await fetch(`http://127.0.0.1:${port}/family/events`, {
      headers: u.auth,
      signal: ctrl.signal,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    ctrl.abort();
  });
});
