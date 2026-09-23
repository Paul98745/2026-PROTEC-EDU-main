import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const databaseUrl =
  process.env.PRISMA_DATABASE_TARGET === 'test'
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl ?? '',
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL ?? '',
  },
});
