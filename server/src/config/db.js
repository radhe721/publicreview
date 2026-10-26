import { createClient } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { env } from './env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getClientOptions() {
  // Tests must never touch the real (Turso) database: they create users, ideas and ratings.
  if (env.NODE_ENV === 'test') {
    const testDbPath = path.resolve(__dirname, '../db/ideapulse.test.db');
    return { url: `file:${testDbPath}` };
  }

  if (env.TURSO_DATABASE_URL) {
    return {
      url: env.TURSO_DATABASE_URL,
      authToken: env.TURSO_AUTH_TOKEN || undefined
    };
  }

  const dbPath = path.isAbsolute(env.DATABASE_PATH)
    ? env.DATABASE_PATH
    : path.resolve(__dirname, '../../', env.DATABASE_PATH);

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  return {
    url: `file:${dbPath}`
  };
}

export const client = createClient(getClientOptions());

function normalizeArgs(args) {
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0].map(a => (a === undefined ? null : a));
  }
  return args.map(a => (a === undefined ? null : a));
}

function createStatement(executor, sql) {
  return {
    get: async (...args) => {
      const result = await executor.execute({
        sql,
        args: normalizeArgs(args)
      });
      return result.rows[0] || null;
    },
    all: async (...args) => {
      const result = await executor.execute({
        sql,
        args: normalizeArgs(args)
      });
      return result.rows || [];
    },
    run: async (...args) => {
      const result = await executor.execute({
        sql,
        args: normalizeArgs(args)
      });
      return {
        lastInsertRowid: result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : 0,
        changes: result.rowsAffected,
        rowsAffected: result.rowsAffected
      };
    }
  };
}

export const db = {
  client,
  prepare: (sql) => createStatement(client, sql),
  execute: async (sql, args = []) => {
    if (typeof sql === 'object' && sql.sql) {
      return client.execute(sql);
    }
    return client.execute({ sql, args: normalizeArgs(args) });
  },
  exec: async (sql) => {
    return client.executeMultiple(sql);
  },
  pragma: async (statement) => {
    try {
      return await client.execute(`PRAGMA ${statement}`);
    } catch {
      // PRAGMA operations can be no-ops or restricted on remote Turso, safely ignore
      return null;
    }
  },
  transaction: async (fn) => {
    const tx = await client.transaction('write');
    try {
      const txDb = {
        prepare: (sql) => createStatement(tx, sql),
        execute: (sql, args = []) => tx.execute({ sql, args: normalizeArgs(args) })
      };
      const result = await fn(txDb);
      await tx.commit();
      return result;
    } catch (err) {
      try {
        await tx.rollback();
      } catch {
        // Rollback error ignored if already aborted
      }
      throw err;
    }
  }
};

export default db;
