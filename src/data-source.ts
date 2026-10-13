import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { ENTITIES } from './entities';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? process.env.DATABASE_HOST,
  port: Number(process.env.DB_PORT ?? process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: ENTITIES,
  migrations: ['src/migrations/*.ts'],
  synchronize: false, // migrations replace synchronize
});