import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false
});

export const db = drizzle(client, { schema });

export const connectDB = async () => {
  try {
    await client`SELECT 1`;
    console.log('✅ PostgreSQL database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error);
    return false;
  }
};

export const isUsingMockDB = () => false;