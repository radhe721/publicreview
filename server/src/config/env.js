import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  PORT: process.env.PORT || 5001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  JWT_SECRET: process.env.JWT_SECRET || 'fallback_secret_for_local_testing_only_12345',
  DATABASE_PATH: process.env.DATABASE_PATH || './src/db/ideapulse.db',
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL || '',
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN || ''
};
