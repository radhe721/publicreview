import { app } from './app.js';
import { env } from './config/env.js';
import { runMigrations } from './db/migrate.js';

async function startServer() {
  try {
    await runMigrations();
  } catch (err) {
    console.error('Failed to run database migrations on boot:', err);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 IdeaPulse API Server is running on http://localhost:${env.PORT}`);
    console.log(`📡 CORS configured for client at ${env.CLIENT_URL}`);
    if (env.TURSO_DATABASE_URL) {
      console.log(`☁️ Connected to Turso database: ${env.TURSO_DATABASE_URL}`);
    }
  });

  function gracefulShutdown(signal) {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      console.log('✅ HTTP server closed.');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer();
