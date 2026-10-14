import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createApp,
  createRecipe,
  registerUser,
  seedIngredient,
} from './helpers';

type User = Awaited<ReturnType<typeof registerUser>>;

describe('People: names, public profiles, following (e2e)', () => {
  let app: INestApplication;
  let rice: number;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
    rice = await seedIngredient(app, 'Rice');
  });

  afterAll(async () => {
    await app.close();
  });

  const me = async (u: User) =>
    (await http().get('/auth/profile').set(u.auth).expect(200)).body.user;
  const recipe = (u: User, name: string, isPublic = true) =>
    createRecipe(app, u.auth, {
      name,
      isPublic,
      ingredients: [{ ingredientId: rice, amount: 100 }],
    });

  describe('username and name', () => {
    it('gets a username from the email, numbered when taken', async () => {
      const stamp = Date.now();
      const a = await registerUser(app, `chef${stamp}@test.dev`);
      const b = await registerUser(app, `chef${stamp}@other.dev`);
      expect((await me(a)).username).toBe(`chef${stamp}`);
      expect((await me(b)).username).toBe(`chef${stamp}1`);
      expect(await me(a)).toMatchObject({
        firstName: '',
        lastName: '',
        showFullName: false,
      });
    });

    it('changes the username, name and its visibility; usernames stay unique', async () => {
      const a = await registerUser(app);
      const b = await registerUser(app);
      const nick = `anna_${Date.now()}`;
      const res = await http()
        .patch('/auth/profile')
        .set(a.auth)
        .send({
          username: ` ${nick.toUpperCase()} `,
          firstName: ' Anna ',
          lastName: 'Smith',
          showFullName: true,
        })
        .expect(200);
      expect(res.body.user).toMatchObject({
        username: nick,
        firstName: 'Anna',
        lastName: 'Smith',
        showFullName: true,
      });

      await http()
        .patch('/auth/profile')
        .set(b.auth)
        .send({ username: nick })
        .expect(409);
      await http()
        .patch('/auth/profile')
        .set(b.auth)
        .send({ username: 'no spaces!' })
        .expect(400);
      await http()
        .patch('/auth/profile')
        .set(b.auth)
        .send({ username: 'ab' })
        .expect(400);
      // the language alone still works
      await http()
        .patch('/auth/profile')
        .set(b.auth)
        .send({ language: 'ru' })
        .expect(200);
    });
  });

  describe('author on recipes', () => {
    it('shows the username, and the name only when allowed — never the email', async () => {
      const author = await registerUser(app);
      const reader = await registerUser(app);
      const r = await recipe(author, 'Plov');
      const { username } = await me(author);

      let detail = (
        await http()
          .get(`/recipes/${r.id}?lang=en`)
          .set(reader.auth)
          .expect(200)
      ).body;
      expect(detail.author).toEqual({ username, name: null, followed: false });
      expect(JSON.stringify(detail)).not.toContain(author.email);

      await http()
        .patch('/auth/profile')
        .set(author.auth)
        .send({ firstName: 'Ivan', lastName: 'Petrov' })
        .expect(200);
      detail = (
        await http()
          .get(`/recipes/${r.id}?lang=en`)
          .set(reader.auth)
          .expect(200)
      ).body;
      expect(detail.author.name).toBeNull(); // still hidden
      await http()
        .patch('/auth/profile')
        .set(author.auth)
        .send({ showFullName: true })
        .expect(200);
      detail = (
        await http()
          .get(`/recipes/${r.id}?lang=en`)
          .set(reader.auth)
          .expect(200)
      ).body;
      expect(detail.author.name).toBe('Ivan Petrov');

      const list = (
        await http().get('/recipes?lang=en').set(reader.auth).expect(200)
      ).body;
      expect(list.find((x: { id: number }) => x.id === r.id).author).toEqual({
        username,
        name: 'Ivan Petrov',
        followed: false,
      });
    });
  });

  describe('public profile', () => {
    it('lists only the public recipes, with counts', async () => {
      const author = await registerUser(app);
      const reader = await registerUser(app);
      await recipe(author, 'Open soup');
      await recipe(author, 'Secret soup', false);
      const { username } = await me(author);

      const res = await http()
        .get(`/people/${username}?lang=en`)
        .set(reader.auth)
        .expect(200);
      expect(res.body).toMatchObject({
        username,
        name: null,
        isMe: false,
        followedByMe: false,
        followers: 0,
        following: 0,
      });
      expect(res.body.recipes.map((x: { name: string }) => x.name)).toEqual([
        'Open soup',
      ]);
      expect(res.body).not.toHaveProperty('email');

      // own profile looks the same from the outside (private ones live in /recipes)
      const own = await http()
        .get(`/people/${username}?lang=en`)
        .set(author.auth)
        .expect(200);
      expect(own.body.isMe).toBe(true);
      expect(own.body.recipes).toHaveLength(1);

      await http()
        .get('/people/nobody_here_404?lang=en')
        .set(reader.auth)
        .expect(404);
    });
  });

  describe('following', () => {
    it('follows and unfollows, counts and lists both sides', async () => {
      const author = await registerUser(app);
      const fan = await registerUser(app);
      const { username } = await me(author);
      const fanName = (await me(fan)).username;

      expect(
        (
          await http()
            .post(`/people/${username}/follow`)
            .set(fan.auth)
            .expect(201)
        ).body,
      ).toEqual({ followedByMe: true, followers: 1 });
      // twice is fine
      expect(
        (
          await http()
            .post(`/people/${username}/follow`)
            .set(fan.auth)
            .expect(201)
        ).body,
      ).toEqual({ followedByMe: true, followers: 1 });

      const profile = (await http().get(`/people/${username}`).set(fan.auth))
        .body;
      expect(profile).toMatchObject({ followedByMe: true, followers: 1 });
      expect(
        (await http().get(`/people/${fanName}`).set(fan.auth)).body.following,
      ).toBe(1);

      expect(
        (
          await http()
            .get(`/people/${username}/followers`)
            .set(author.auth)
            .expect(200)
        ).body,
      ).toEqual([
        { username: fanName, name: null, isMe: false, followedByMe: false },
      ]);
      expect(
        (
          await http()
            .get(`/people/${fanName}/following`)
            .set(fan.auth)
            .expect(200)
        ).body,
      ).toEqual([{ username, name: null, isMe: false, followedByMe: true }]);

      expect(
        (
          await http()
            .delete(`/people/${username}/follow`)
            .set(fan.auth)
            .expect(200)
        ).body,
      ).toEqual({ followedByMe: false, followers: 0 });
    });

    it('can’t follow yourself', async () => {
      const u = await registerUser(app);
      await http()
        .post(`/people/${(await me(u)).username}/follow`)
        .set(u.auth)
        .expect(400);
    });

    it('marks followed authors on recipes and puts their recipes first in the feed', async () => {
      const author = await registerUser(app);
      const fan = await registerUser(app);
      const { username } = await me(author);
      const theirs = await recipe(author, 'Followed dish');
      await http().post(`/people/${username}/follow`).set(fan.auth).expect(201);

      const list = (await http().get('/recipes?lang=en').set(fan.auth)).body;
      expect(
        list.find((x: { id: number }) => x.id === theirs.id).author.followed,
      ).toBe(true);

      const feed = (
        await http()
          .get('/recipes/feed?lang=en&limit=1')
          .set(fan.auth)
          .expect(200)
      ).body;
      expect(feed.map((x: { id: number }) => x.id)).toEqual([theirs.id]);
    });
  });
});
