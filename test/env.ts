// e2e-тесты ходят в отдельную базу, чтобы не трогать данные разработки
import { config } from 'dotenv';

config();
process.env.DATABASE_NAME = process.env.TEST_DATABASE_NAME ?? 'nestjs_auth_test';
process.env.JWT_SECRET ??= 'test-secret';
