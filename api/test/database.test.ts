import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Database', () => {
  it('should create tables on initialization', () => {
    const testDbPath = path.join(__dirname, '../../data/test-nexlan.db');
    const dir = path.dirname(testDbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    const db = new Database(testDbPath);
    db.pragma('journal_mode = WAL');
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

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{ name: string }>;
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('messages');
    expect(tableNames).toContain('device_names');
    expect(tableNames).toContain('file_md5_index');

    db.prepare('INSERT INTO messages (id, content, sender, sender_id, timestamp) VALUES (?, ?, ?, ?, ?)').run('1', 'hello', 'Alice', 'dev-1', '2026-01-01T00:00:00.000Z');
    const msgs = db.prepare('SELECT * FROM messages').all();
    expect(msgs).toHaveLength(1);

    db.prepare('INSERT INTO device_names (device_id, name) VALUES (?, ?)').run('dev-1', 'MyDevice');
    const devices = db.prepare('SELECT * FROM device_names').all();
    expect(devices).toHaveLength(1);

    db.prepare('INSERT INTO file_md5_index (md5, file_id) VALUES (?, ?)').run('abc123', 'file-1');
    const md5s = db.prepare('SELECT * FROM file_md5_index').all();
    expect(md5s).toHaveLength(1);

    db.close();
    fs.unlinkSync(testDbPath);
  });
});
