import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, createRecipe, registerUser, seedIngredient, uniqueEmail } from './helpers';

type User = Awaited<ReturnType<typeof registerUser>>;

describe('Family (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const createFamily = async (u: User, name = 'Smiths') =>
    (await http().post('/family?lang=en').set(u.auth).send({ name }).expect(201)).body;

  const invite = (admin: User, email: string) => http().post('/family/invites').set(admin.auth).send({ email });

  // admin + n members who accepted
  async function family(n = 1) {
    const admin = await registerUser(app);
    await createFamily(admin);
    const members: User[] = [];
    for (let i = 0; i < n; i++) {
      const m = await registerUser(app);
      await invite(admin, m.email).expect(201);
      const { body } = await http().get('/family').set(m.auth).expect(200);
      await http().post(`/family/invitations/${body.invitations[0].id}/accept`).set(m.auth).expect(201);
      members.push(m);
    }
    return { admin, members };
  }

  // change a member's role; resolves to the response
  async function promote(admin: User, member: User, role: 'admin' | 'member') {
    const { body } = await http().get('/family').set(member.auth);
    const me = body.family.members.find((x: { isMe: boolean }) => x.isMe);
    return http().patch(`/family/members/${me.userId}`).set(admin.auth).send({ role });
  }

  describe('membership', () => {
    it('creates a family with its own budget, the creator as admin', async () => {
      const u = await registerUser(app);
      expect((await http().get('/family').set(u.auth).expect(200)).body).toEqual({ family: null, invitations: [] });

      const res = await createFamily(u, 'Smiths');
      expect(res.family).toMatchObject({ name: 'Smiths', myRole: 'admin', maxMembers: 5, invites: [] });
      expect(res.family.members).toEqual([expect.objectContaining({ email: u.email, role: 'admin', isMe: true })]);

      const wallets = (await http().get('/finance/wallets?scope=family').set(u.auth).expect(200)).body;
      expect(wallets).toEqual([expect.objectContaining({ name: 'Family budget', balance: 0, family: true })]);
      const cats = (await http().get('/finance/categories?scope=family').set(u.auth).expect(200)).body;
      expect(cats.find((c: { key: string }) => c.key === 'groceries')).toBeTruthy();

      // the personal budget stays separate
      const personal = (await http().get('/finance/wallets').set(u.auth).expect(200)).body;
      expect(personal.map((w: { name: string }) => w.name)).toEqual(['Cash']);

      await http().post('/family').set(u.auth).send({ name: 'Second' }).expect(409);
    });

    it('joins only by accepting an invite', async () => {
      const admin = await registerUser(app);
      const bob = await registerUser(app);
      await createFamily(admin);
      await invite(admin, bob.email.toUpperCase()).expect(201); // emails are case-insensitive
      await invite(admin, bob.email).expect(409);

      // invited but not in yet: no family data
      await http().get('/finance/wallets?scope=family').set(bob.auth).expect(403);
      const mine = (await http().get('/family').set(bob.auth).expect(200)).body;
      expect(mine.family).toBeNull();
      expect(mine.invitations).toEqual([{ id: expect.any(Number), familyName: 'Smiths', invitedBy: admin.email }]);

      // someone else can't accept it
      const eve = await registerUser(app);
      await http().post(`/family/invitations/${mine.invitations[0].id}/accept`).set(eve.auth).expect(404);

      const joined = (await http().post(`/family/invitations/${mine.invitations[0].id}/accept`).set(bob.auth).expect(201)).body;
      expect(joined.family).toMatchObject({ name: 'Smiths', myRole: 'member' });
      expect(joined.invitations).toEqual([]);
      await http().get('/finance/wallets?scope=family').set(bob.auth).expect(200);
    });

    it('can invite someone who registers later', async () => {
      const { admin } = await family(0);
      const email = uniqueEmail();
      await invite(admin, email).expect(201);
      const later = await registerUser(app, email);
      expect((await http().get('/family').set(later.auth)).body.invitations).toHaveLength(1);
    });

    it('declines and cancels invites', async () => {
      const { admin } = await family(0);
      const bob = await registerUser(app);
      const sent = (await invite(admin, bob.email).expect(201)).body;
      expect(sent.family.invites).toEqual([{ id: expect.any(Number), email: bob.email }]);

      const inv = (await http().get('/family').set(bob.auth)).body.invitations[0];
      await http().delete(`/family/invitations/${inv.id}`).set(bob.auth).expect(200);
      expect((await http().get('/family').set(admin.auth)).body.family.invites).toEqual([]);

      const again = (await invite(admin, bob.email).expect(201)).body;
      await http().delete(`/family/invites/${again.family.invites[0].id}`).set(admin.auth).expect(200);
      expect((await http().get('/family').set(bob.auth)).body.invitations).toEqual([]);
    });

    it('allows at most 5 people, counting pending invites', async () => {
      const { admin } = await family(2); // 3 members
      await invite(admin, uniqueEmail()).expect(201); // 4
      await invite(admin, uniqueEmail()).expect(201); // 5
      await invite(admin, uniqueEmail()).expect(409);
    });

    it('one family per person', async () => {
      const a = await family(1);
      const b = await family(0);
      await invite(b.admin, a.members[0].email).expect(201);
      const inv = (await http().get('/family').set(a.members[0].auth)).body.invitations[0];
      await http().post(`/family/invitations/${inv.id}/accept`).set(a.members[0].auth).expect(409);
    });

    it('only admins manage the family; there is always an admin', async () => {
      const { admin, members: [bob, carol] } = await family(2);
      await invite(bob, uniqueEmail()).expect(403);
      await http().patch('/family').set(bob.auth).send({ name: 'x' }).expect(403);

      // the only admin can't step down
      const adminId = (await http().get('/family').set(admin.auth)).body.family.members.find((m: { isMe: boolean }) => m.isMe).userId;
      await http().patch(`/family/members/${adminId}`).set(admin.auth).send({ role: 'member' }).expect(409);
      await http().post('/family/leave').set(admin.auth).expect(409);

      expect((await promote(admin, bob, 'admin')).status).toBe(200);
      expect((await http().get('/family').set(bob.auth)).body.family.myRole).toBe('admin');
      // with a second admin the first can leave
      await http().post('/family/leave').set(admin.auth).expect(201);
      expect((await http().get('/family').set(admin.auth)).body.family).toBeNull();

      // bob removes carol
      const carolId = (await http().get('/family').set(carol.auth)).body.family.members.find((m: { isMe: boolean }) => m.isMe).userId;
      await http().delete(`/family/members/${carolId}`).set(bob.auth).expect(200);
      expect((await http().get('/family').set(carol.auth)).body.family).toBeNull();
    });

    it('the last person leaving removes the family and its shared data', async () => {
      const { admin } = await family(0);
      await http().post('/tasks?scope=family').set(admin.auth).send({ title: 'Shared', date: '2026-10-14' }).expect(201);
      await http().post('/family/leave').set(admin.auth).expect(201);
      await http().get('/tasks?from=2026-10-12&scope=family').set(admin.auth).expect(403);
      // a new family starts empty
      await createFamily(admin);
      expect((await http().get('/tasks?from=2026-10-12&scope=family').set(admin.auth)).body).toEqual([]);
    });
  });

  describe('shared data and roles', () => {
    it('members see the family budget, plans and menu but cannot change them', async () => {
      const { admin, members: [kid] } = await family(1);
      const [wallet] = (await http().get('/finance/wallets?scope=family').set(admin.auth)).body;
      await http()
        .post('/finance/transactions?scope=family')
        .set(admin.auth)
        .send({ type: 'expense', walletId: wallet.id, amount: 30, date: '2026-10-14', note: 'Pizza' })
        .expect(201);
      await http().post('/tasks?scope=family').set(admin.auth).send({ title: 'Clean up', date: '2026-10-14' }).expect(201);

      const list = (await http().get('/finance/transactions?scope=family').set(kid.auth).expect(200)).body;
      expect(list).toEqual([expect.objectContaining({ note: 'Pizza', amount: 30, author: admin.email })]);
      expect((await http().get('/tasks?from=2026-10-12&scope=family').set(kid.auth).expect(200)).body).toHaveLength(1);
      await http().get('/menu?scope=family').set(kid.auth).expect(200);

      await http().post('/finance/transactions?scope=family').set(kid.auth).send({ type: 'expense', walletId: wallet.id, amount: 1, date: '2026-10-14' }).expect(403);
      await http().post('/finance/wallets?scope=family').set(kid.auth).send({ name: 'Mine' }).expect(403);
      await http().post('/tasks?scope=family').set(kid.auth).send({ title: 'x', date: '2026-10-14' }).expect(403);
      await http().put('/menu/days/2026-10-14?scope=family').set(kid.auth).send({ meals: [] }).expect(403);

      // promoted to admin — can edit
      expect((await promote(admin, kid, 'admin')).status).toBe(200);
      await http().post('/tasks?scope=family').set(kid.auth).send({ title: 'x', date: '2026-10-14' }).expect(201);
    });

    it('keeps personal and family data apart', async () => {
      const { admin } = await family(0);
      await http().post('/tasks').set(admin.auth).send({ title: 'Mine', date: '2026-10-14' }).expect(201);
      await http().post('/tasks?scope=family').set(admin.auth).send({ title: 'Ours', date: '2026-10-14' }).expect(201);
      const personal = (await http().get('/tasks?from=2026-10-12').set(admin.auth)).body;
      const shared = (await http().get('/tasks?from=2026-10-12&scope=family').set(admin.auth)).body;
      expect(personal.map((t: { title: string }) => t.title)).toEqual(['Mine']);
      expect(shared.map((t: { title: string }) => t.title)).toEqual(['Ours']);

      // a family task can't be touched through the personal scope
      await http().patch(`/tasks/${shared[0].id}`).set(admin.auth).send({ done: true }).expect(404);
      await http().patch(`/tasks/${shared[0].id}?scope=family`).set(admin.auth).send({ done: true }).expect(200);
    });

    it('moves money from a personal wallet into the family budget', async () => {
      const { admin, members: [kid] } = await family(1);
      const [cash] = (await http().get('/finance/wallets').set(admin.auth)).body;
      const [fam] = (await http().get('/finance/wallets?scope=family').set(admin.auth)).body;
      await http().patch(`/finance/wallets/${cash.id}`).set(admin.auth).send({ initialBalance: 1000 }).expect(200);

      await http().post('/finance/transfers').set(admin.auth).send({ fromWalletId: cash.id, toWalletId: fam.id, amount: 500, date: '2026-10-14' }).expect(201);
      expect((await http().get('/finance/wallets').set(admin.auth)).body[0].balance).toBe(500);
      expect((await http().get('/finance/wallets?scope=family').set(kid.auth)).body[0].balance).toBe(500);

      // a transfer is neither spending nor income
      expect((await http().get('/finance/summary').set(admin.auth)).body).toMatchObject({ income: 0, expense: 0 });
      expect((await http().get('/finance/summary?scope=family').set(admin.auth)).body).toMatchObject({ income: 0, expense: 0 });
      const famList = (await http().get('/finance/transactions?scope=family').set(admin.auth)).body;
      expect(famList).toEqual([expect.objectContaining({ type: 'income', amount: 500, transfer: true })]);

      // view-only members can't move money in or out
      const [kidCash] = (await http().get('/finance/wallets').set(kid.auth)).body;
      await http().post('/finance/transfers').set(kid.auth).send({ fromWalletId: kidCash.id, toWalletId: fam.id, amount: 1, date: '2026-10-14' }).expect(403);
      // nor touch someone else's wallet
      await http().post('/finance/transfers').set(kid.auth).send({ fromWalletId: cash.id, toWalletId: kidCash.id, amount: 1, date: '2026-10-14' }).expect(404);

      // transfers aren't edited, only undone — both sides at once
      await http().patch(`/finance/transactions/${famList[0].id}?scope=family`).set(admin.auth).send({ amount: 1 }).expect(400);
      await http().delete(`/finance/transactions/${famList[0].id}?scope=family`).set(admin.auth).expect(200);
      expect((await http().get('/finance/wallets').set(admin.auth)).body[0].balance).toBe(1000);
      expect((await http().get('/finance/transactions').set(admin.auth)).body).toEqual([]);
    });

    it('settles a family task in the family budget', async () => {
      const { admin } = await family(0);
      const task = (await http().post('/tasks?scope=family').set(admin.auth).send({ title: 'Shopping', date: '2026-10-14', source: 'food' })).body;
      const [fam] = (await http().get('/finance/wallets?scope=family').set(admin.auth)).body;
      const [cash] = (await http().get('/finance/wallets').set(admin.auth)).body;

      // not through the personal budget
      await http().post('/finance/transactions').set(admin.auth).send({ type: 'expense', walletId: cash.id, amount: 5, date: '2026-10-14', taskId: task.id }).expect(404);
      await http().post('/finance/transactions?scope=family').set(admin.auth).send({ type: 'expense', walletId: fam.id, amount: 45, date: '2026-10-14', taskId: task.id }).expect(201);
      expect((await http().get('/tasks?from=2026-10-12&scope=family').set(admin.auth)).body[0].done).toBe(true);
    });

    it('family menu: each admin adds from their own liked recipes', async () => {
      const { admin: mom, members: [dad] } = await family(1);
      expect((await promote(mom, dad, 'admin')).status).toBe(200);
      const rice = await seedIngredient(app, 'Rice');
      const pasta = await createRecipe(app, mom.auth, { name: 'Pasta', ingredients: [{ ingredientId: rice, amount: 100 }] });
      const soup = await createRecipe(app, dad.auth, { name: 'Soup', ingredients: [{ ingredientId: rice, amount: 50 }] });
      await http().post(`/recipes/${pasta.id}/like`).set(mom.auth).expect(201);
      await http().post(`/recipes/${soup.id}/like`).set(dad.auth).expect(201);

      await http().put('/menu/days/2026-10-14?scope=family').set(mom.auth).send({ meals: [{ mealType: 'dinner', recipeId: pasta.id, servings: 4 }] }).expect(200);
      // dad hasn't liked pasta — he can't add it himself…
      await http().post('/menu?scope=family').set(dad.auth).send({ date: '2026-10-15', mealType: 'dinner', recipeId: pasta.id, servings: 1 }).expect(400);
      // …but saving the day with mom's pasta kept and his soup added is fine
      await http()
        .put('/menu/days/2026-10-14?scope=family')
        .set(dad.auth)
        .send({ meals: [{ mealType: 'lunch', recipeId: soup.id, servings: 2 }, { mealType: 'dinner', recipeId: pasta.id, servings: 4 }] })
        .expect(200);

      const week = (await http().get('/menu?week=2026-10-14&scope=family&lang=en').set(mom.auth)).body;
      expect(week.days[2].meals.map((m: { recipeName: string; addedBy: string }) => [m.recipeName, m.addedBy])).toEqual([
        ['Soup', dad.email],
        ['Pasta', mom.email],
      ]);
      // the personal menu is untouched
      expect((await http().get('/menu?week=2026-10-14&lang=en').set(mom.auth)).body.days[2].meals).toEqual([]);

      // pasta 100 g × 4 people + soup 50 g × 2 people
      const list = (await http().get('/menu/shopping-list?dates=2026-10-14&scope=family&lang=en').set(dad.auth)).body;
      expect(list).toEqual([expect.objectContaining({ name: 'Rice', amount: 500 })]);
    });
  });
});
