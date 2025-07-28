import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/dxf_visual_ilot';

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