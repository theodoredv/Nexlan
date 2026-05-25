import Database from 'better-sqlite3';
import path from 'path';
import { createLogger } from './logger.js';
import { dataDir, ensureDir } from './config.js';

const log = createLogger('database');

ensureDir(dataDir);

const dbPath = path.join(dataDir, 'nexlan.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    sender TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    timestamp TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS device_names (
    device_id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS file_md5_index (
    md5 TEXT PRIMARY KEY,
    file_id TEXT NOT NULL
  );
`);

log.info(`Database initialized at ${dbPath}`);

export { db };
