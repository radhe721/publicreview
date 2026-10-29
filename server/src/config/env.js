import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';
const DEV_JWT_SECRET = 'fallback_secret_for_local_testing_only_12345';

// Never run production with a missing, short, or publicly known signing secret:
// anyone could forge a session token for any user (including admins).
if (NODE_ENV === 'production') {
  const secret = process.env.JWT_SECRET || '';
  const knownExamples = [DEV_JWT_SECRET, 'super_secret_jwt_key_at_least_32_chars_long_for_security_12345'];
  if (secret.length < 32 || knownExamples.includes(secret)) {
    throw new Error('JWT_SECRET must be set to a unique random string of at least 32 characters in production.');
  }
}

// Render sets RENDER_EXTERNAL_URL to the service's public URL; for a single-origin deploy that is
// both the client and the API, so it's the right default when CLIENT_URL / SERVER_URL are unset.
const RENDER_URL = (process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');

// CLIENT_URL may be a comma-separated list, e.g. "https://ideapulse.app,https://www.ideapulse.app".
// The first entry is used as the redirect target after OAuth sign-in.
const clientUrls = (process.env.CLIENT_URL || RENDER_URL || 'http://localhost:5173')
  .split(',')
  .map((u) => u.trim().replace(/\/$/, ''))
  .filter(Boolean);

export const env = {
  PORT: process.env.PORT || 5001,
  NODE_ENV,
  CLIENT_URL: clientUrls[0],
  CLIENT_URLS: clientUrls,
  // Public base URL of this API server (used to build OAuth callback URLs).
  SERVER_URL: (process.env.SERVER_URL || RENDER_URL).replace(/\/$/, ''),
  JWT_SECRET: process.env.JWT_SECRET || DEV_JWT_SECRET,
  DATABASE_PATH: process.env.DATABASE_PATH || './src/db/ideapulse.db',
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL || '',
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN || '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || '',
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || '',
  // Transactional email (password reset). Without a key, dev logs emails to the console.
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  MAIL_FROM: process.env.MAIL_FROM || 'BusinessListe <onboarding@resend.dev>'
};
