import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Allows client generation without a local database.
    // A real DATABASE_URL is required for database commands.
    url: process.env.DATABASE_URL ?? '',
  },
});