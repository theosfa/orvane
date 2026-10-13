// перед прогоном: создаём тестовую базу (если нет), сносим схему и накатываем все миграции —
// заодно это проверка, что миграции применяются на чистую базу
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { join } from 'path';
import './env';
import { ENTITIES } from '../src/entities';

export default async function globalSetup() {
  const conn = {
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? 5432),
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
  };
  const name = process.env.DATABASE_NAME!;

  const admin = new Client({ ...conn, database: 'postgres' });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  if (!exists.rowCount) await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();

  const ds = new DataSource({
    type: 'postgres',
    host: conn.host,
    port: conn.port,
    username: conn.user,
    password: conn.password,
    database: name,
    entities: ENTITIES,
    migrations: [join(__dirname, '../src/migrations/*.ts')],
  });
  await ds.initialize();
  await ds.dropDatabase();
  await ds.runMigrations();
  await ds.destroy();
}
