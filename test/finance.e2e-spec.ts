import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, registerUser } from './helpers';

describe('Finance (e2e)', () => {
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

  const createWallet = async (name: string, initialBalance = 0) =>
    (
      await http()
        .post('/finance/wallets')
        .set(auth)
        .send({ name, initialBalance })
        .expect(201)
    ).body;

  const categoryId = async (name: string) => {
    const res = await http().get('/finance/categories').set(auth).expect(200);
    return res.body.find((c: { name: string }) => c.name === name).id;
  };

  const addTx = (body: Record<string, unknown>) =>
    http().post('/finance/transactions').set(auth).send(body);

  it('requires auth', async () => {
    await http().get('/finance/wallets').expect(401);
  });

  describe('defaults', () => {
    it('seeds one wallet and default categories in the UI language, once', async () => {
      const wallets = await http()
        .get('/finance/wallets?lang=ru')
        .set(auth)
        .expect(200);
      expect(wallets.body).toEqual([
        expect.objectContaining({ name: 'Наличные', balance: 0 }),
      ]);

      const cats = await http()
        .get('/finance/categories?lang=en')
        .set(auth)
        .expect(200);
      // seeded on the first call (in ru) — a later call in another language doesn't reseed
      expect(cats.body.map((c: { name: string }) => c.name)).toContain('Кафе');
      expect(cats.body.filter((c: { type: string }) => c.type === 'income')).toHaveLength(3);
    });

    it('does not bring back deleted default categories', async () => {
      const cats = (await http().get('/finance/categories').set(auth)).body;
      for (const c of cats) {
        await http().delete(`/finance/categories/${c.id}`).set(auth).expect(200);
      }
      const again = await http().get('/finance/categories').set(auth).expect(200);
      expect(again.body).toEqual([]);
    });

    it('filters categories by type', async () => {
      const res = await http()
        .get('/finance/categories?type=income')
        .set(auth)
        .expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.every((c: { type: string }) => c.type === 'income')).toBe(true);
    });
  });

  describe('wallets', () => {
    it('creates, renames and lists wallets with balances', async () => {
      const w = await createWallet('Card', 100.5);
      expect(w).toMatchObject({ name: 'Card', initialBalance: 100.5, balance: 100.5 });

      const renamed = await http()
        .patch(`/finance/wallets/${w.id}`)
        .set(auth)
        .send({ name: 'Visa' })
        .expect(200);
      expect(renamed.body).toMatchObject({ name: 'Visa', balance: 100.5 });

      const list = await http().get('/finance/wallets').set(auth).expect(200);
      expect(list.body.map((x: { name: string }) => x.name)).toEqual(['Cash', 'Visa']);
    });

    it('balance = initial + income − expenses, can go negative', async () => {
      const w = await createWallet('Card', 10);
      await addTx({ type: 'income', walletId: w.id, amount: 5.25, date: '2026-10-01' }).expect(201);
      await addTx({ type: 'expense', walletId: w.id, amount: 20, date: '2026-10-02' }).expect(201);
      const list = await http().get('/finance/wallets').set(auth).expect(200);
      expect(list.body.find((x: { id: number }) => x.id === w.id).balance).toBe(-4.75);
    });

    it('deletes a wallet only when the balance is exactly zero', async () => {
      const positive = await createWallet('Positive', 3);
      await http().delete(`/finance/wallets/${positive.id}`).set(auth).expect(409);

      const negative = await createWallet('Negative', 0);
      await addTx({ type: 'expense', walletId: negative.id, amount: 1, date: '2026-10-01' }).expect(201);
      await http().delete(`/finance/wallets/${negative.id}`).set(auth).expect(409);

      // bring it back to zero — now it can go
      await addTx({ type: 'income', walletId: negative.id, amount: 1, date: '2026-10-02' }).expect(201);
      await http().delete(`/finance/wallets/${negative.id}`).set(auth).expect(200);

      const list = await http().get('/finance/wallets').set(auth).expect(200);
      expect(list.body.map((x: { name: string }) => x.name)).not.toContain('Negative');
    });

    it("cannot touch another user's wallet", async () => {
      const w = await createWallet('Mine');
      const other = await registerUser(app);
      await http().patch(`/finance/wallets/${w.id}`).set(other.auth).send({ name: 'x' }).expect(404);
      await http().delete(`/finance/wallets/${w.id}`).set(other.auth).expect(404);
      await http()
        .post('/finance/transactions')
        .set(other.auth)
        .send({ type: 'expense', walletId: w.id, amount: 1, date: '2026-10-01' })
        .expect(404);
    });

    it('validates input', async () => {
      await http().post('/finance/wallets').set(auth).send({ name: '' }).expect(400);
      await http().post('/finance/wallets').set(auth).send({ name: 'x', initialBalance: 1.234 }).expect(400);
    });
  });

  describe('categories', () => {
    it('creates, renames and deletes a custom category', async () => {
      const created = await http()
        .post('/finance/categories')
        .set(auth)
        .send({ name: 'Books', type: 'expense' })
        .expect(201);
      expect(created.body).toMatchObject({ name: 'Books', type: 'expense' });

      const renamed = await http()
        .patch(`/finance/categories/${created.body.id}`)
        .set(auth)
        .send({ name: 'Comics' })
        .expect(200);
      expect(renamed.body.name).toBe('Comics');

      await http().delete(`/finance/categories/${created.body.id}`).set(auth).expect(200);
      const list = await http().get('/finance/categories').set(auth);
      expect(list.body.map((c: { name: string }) => c.name)).not.toContain('Comics');
    });

    it('rejects duplicate names within one type, case-insensitively', async () => {
      await http().get('/finance/categories').set(auth); // seed
      await http().post('/finance/categories').set(auth).send({ name: 'coffee', type: 'expense' }).expect(409);
      // same name as an income category is fine
      await http().post('/finance/categories').set(auth).send({ name: 'Coffee', type: 'income' }).expect(201);

      const cafe = await categoryId('Cafe');
      await http().patch(`/finance/categories/${cafe}`).set(auth).send({ name: 'COFFEE' }).expect(409);
      // renaming to itself with another case is fine
      await http().patch(`/finance/categories/${cafe}`).set(auth).send({ name: 'CAFE' }).expect(200);
    });

    it('keeps transactions of a deleted category, without a category', async () => {
      const [wallet] = (await http().get('/finance/wallets').set(auth)).body;
      const cafe = await categoryId('Cafe');
      const tx = await addTx({ type: 'expense', walletId: wallet.id, categoryId: cafe, amount: 7, date: '2026-10-03' }).expect(201);

      await http().delete(`/finance/categories/${cafe}`).set(auth).expect(200);
      const list = await http().get('/finance/transactions').set(auth).expect(200);
      expect(list.body).toEqual([
        expect.objectContaining({ id: tx.body.id, categoryId: null, categoryName: null, amount: 7 }),
      ]);
    });
  });

  describe('transactions', () => {
    let walletId: number;
    let otherWalletId: number;

    beforeEach(async () => {
      walletId = (await http().get('/finance/wallets').set(auth)).body[0].id;
      otherWalletId = (await createWallet('Card')).id;
    });

    it('creates an income and an expense with names resolved', async () => {
      const salary = await categoryId('Salary');
      const res = await addTx({ type: 'income', walletId, categoryId: salary, amount: 1500, note: ' October ', date: '2026-10-01' }).expect(201);
      expect(res.body).toMatchObject({
        type: 'income',
        amount: 1500,
        note: 'October',
        date: '2026-10-01',
        walletName: 'Cash',
        categoryName: 'Salary',
      });
    });

    it('rejects a category of the other type, and foreign/unknown refs', async () => {
      const cafe = await categoryId('Cafe');
      await addTx({ type: 'income', walletId, categoryId: cafe, amount: 1, date: '2026-10-01' }).expect(400);
      await addTx({ type: 'expense', walletId: 999999, amount: 1, date: '2026-10-01' }).expect(404);
      await addTx({ type: 'expense', walletId, amount: 0, date: '2026-10-01' }).expect(400);
      await addTx({ type: 'expense', walletId, amount: 1, date: '2026-13-01' }).expect(400);
      await addTx({ type: 'transfer', walletId, amount: 1, date: '2026-10-01' }).expect(400);
    });

    it('updates and deletes a transaction', async () => {
      const cafe = await categoryId('Cafe');
      const coffee = await categoryId('Coffee');
      const tx = (await addTx({ type: 'expense', walletId, categoryId: cafe, amount: 4, date: '2026-10-01' })).body;

      const updated = await http()
        .patch(`/finance/transactions/${tx.id}`)
        .set(auth)
        .send({ amount: 4.5, categoryId: coffee, walletId: otherWalletId })
        .expect(200);
      expect(updated.body).toMatchObject({ amount: 4.5, categoryName: 'Coffee', walletName: 'Card' });

      // switching to income while keeping an expense category is rejected
      await http().patch(`/finance/transactions/${tx.id}`).set(auth).send({ type: 'income' }).expect(400);
      // …but fine together with clearing the category
      await http().patch(`/finance/transactions/${tx.id}`).set(auth).send({ type: 'income', categoryId: null }).expect(200);

      await http().delete(`/finance/transactions/${tx.id}`).set(auth).expect(200);
      await http().delete(`/finance/transactions/${tx.id}`).set(auth).expect(404);
    });

    it('filters by type, category, wallet and date range', async () => {
      const cafe = await categoryId('Cafe');
      const coffee = await categoryId('Coffee');
      const salary = await categoryId('Salary');
      await addTx({ type: 'expense', walletId, categoryId: cafe, amount: 10, date: '2026-09-05' });
      await addTx({ type: 'expense', walletId, categoryId: cafe, amount: 12, date: '2026-10-05' });
      await addTx({ type: 'expense', walletId: otherWalletId, categoryId: coffee, amount: 3, date: '2026-10-06' });
      await addTx({ type: 'income', walletId, categoryId: salary, amount: 2000, date: '2026-09-28' });
      await addTx({ type: 'expense', walletId, amount: 1, date: '2026-10-07' });

      const get = async (q: string) =>
        (await http().get(`/finance/transactions?${q}`).set(auth).expect(200)).body.map(
          (t: { amount: number }) => t.amount,
        );

      expect(await get('')).toEqual([1, 3, 12, 2000, 10]); // newest first
      expect(await get('type=income')).toEqual([2000]);
      expect(await get(`categoryId=${cafe}`)).toEqual([12, 10]);
      expect(await get('categoryId=none')).toEqual([1]);
      expect(await get(`walletId=${otherWalletId}`)).toEqual([3]);
      expect(await get('from=2026-09-01&to=2026-09-30')).toEqual([2000, 10]);
      expect(await get(`from=2026-10-01&type=expense&categoryId=${cafe}`)).toEqual([12]);
      await http().get('/finance/transactions?from=yesterday').set(auth).expect(400);
    });

    it("never shows another user's transactions", async () => {
      await addTx({ type: 'expense', walletId, amount: 5, date: '2026-10-01' }).expect(201);
      const other = await registerUser(app);
      const res = await http().get('/finance/transactions').set(other.auth).expect(200);
      expect(res.body).toEqual([]);
    });

    it('summarises a period by category', async () => {
      const cafe = await categoryId('Cafe');
      const salary = await categoryId('Salary');
      await addTx({ type: 'expense', walletId, categoryId: cafe, amount: 10.1, date: '2026-09-05' });
      await addTx({ type: 'expense', walletId, categoryId: cafe, amount: 0.2, date: '2026-09-06' });
      await addTx({ type: 'expense', walletId, amount: 4, date: '2026-09-07' });
      await addTx({ type: 'income', walletId, categoryId: salary, amount: 1000, date: '2026-09-28' });
      await addTx({ type: 'expense', walletId, categoryId: cafe, amount: 99, date: '2026-10-01' }); // outside

      const res = await http()
        .get('/finance/summary?from=2026-09-01&to=2026-09-30')
        .set(auth)
        .expect(200);
      expect(res.body).toEqual({
        income: 1000,
        expense: 14.3,
        net: 985.7,
        byCategory: [
          { type: 'income', categoryId: salary, name: 'Salary', total: 1000, count: 1 },
          { type: 'expense', categoryId: cafe, name: 'Cafe', total: 10.3, count: 2 },
          { type: 'expense', categoryId: null, name: null, total: 4, count: 1 },
        ],
      });

      // "how much went on cafe last month"
      const cafeOnly = await http()
        .get(`/finance/summary?from=2026-09-01&to=2026-09-30&categoryId=${cafe}`)
        .set(auth)
        .expect(200);
      expect(cafeOnly.body.expense).toBe(10.3);
    });
  });

  describe('category keys', () => {
    it('gives default categories a stable key that survives renaming', async () => {
      const cats = (await http().get('/finance/categories?lang=pl').set(auth).expect(200)).body;
      const groceries = cats.find((c: { key: string }) => c.key === 'groceries');
      expect(groceries).toMatchObject({ name: 'Spożywcze', type: 'expense' });
      expect(cats.find((c: { key: string }) => c.key === 'salary').type).toBe('income');

      await http().patch(`/finance/categories/${groceries.id}`).set(auth).send({ name: 'Jedzenie' }).expect(200);
      const again = (await http().get('/finance/categories').set(auth)).body;
      expect(again.find((c: { id: number }) => c.id === groceries.id)).toMatchObject({ name: 'Jedzenie', key: 'groceries' });

      const own = await http().post('/finance/categories').set(auth).send({ name: 'Books', type: 'expense' }).expect(201);
      expect(own.body.key).toBeNull();
    });
  });

  describe('settling a Plans task', () => {
    const task = async (a: Record<string, string>, title = 'Shopping list') =>
      (await http().post('/tasks').set(a).send({ title, date: '2026-10-15', source: 'food' }).expect(201)).body;

    it('records the expense and marks the task done together', async () => {
      const t = await task(auth);
      const [wallet] = (await http().get('/finance/wallets').set(auth)).body;
      const groceries = (await http().get('/finance/categories').set(auth)).body.find((c: { key: string }) => c.key === 'groceries');

      const res = await addTx({ type: 'expense', walletId: wallet.id, categoryId: groceries.id, amount: 64.2, note: t.title, date: '2026-10-16', taskId: t.id }).expect(201);
      expect(res.body).toMatchObject({ amount: 64.2, note: 'Shopping list', categoryName: 'Groceries' });

      const tasks = (await http().get('/tasks?from=2026-10-12').set(auth)).body;
      expect(tasks[0]).toMatchObject({ id: t.id, done: true });
    });

    it("saves nothing when the task isn't yours", async () => {
      const other = await registerUser(app);
      const foreign = await task(other.auth);
      const [wallet] = (await http().get('/finance/wallets').set(auth)).body;

      await addTx({ type: 'expense', walletId: wallet.id, amount: 10, date: '2026-10-16', taskId: foreign.id }).expect(404);
      expect((await http().get('/finance/transactions').set(auth)).body).toEqual([]);
      expect((await http().get('/tasks?from=2026-10-12').set(other.auth)).body[0].done).toBe(false);
    });
  });
});
