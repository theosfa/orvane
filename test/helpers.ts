// test/helpers.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup-app';

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

// новый юзер на каждый тест — тесты не мешают друг другу
export async function registerUser(app: INestApplication) {
  const email = `user${Date.now()}_${counter++}@test.dev`;
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password: 'password123' })
    .expect(201);
  const token: string = res.body.accessToken;
  return { email, token, auth: { Authorization: `Bearer ${token}` } };
}
