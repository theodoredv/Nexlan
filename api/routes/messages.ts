import crypto from 'crypto';
import express from 'express';
import { Message } from '../../shared/types';
import { createLogger } from '../logger.js';
import { createSSEManager } from '../sse.js';
import { db } from '../database.js';

const log = createLogger('messages');
const sse = createSSEManager('messages');

const router = express.Router();

const MAX_MESSAGES = 200;
const TRIM_TO = 100;

let messages: Message[] = [];

function loadMessages() {
  try {
    const rows = db.prepare('SELECT id, content, sender, sender_id, timestamp FROM messages ORDER BY rowid ASC').all() as Array<{
      id: string;
      content: string;
      sender: string;
      sender_id: string;
      timestamp: string;
    }>;
    messages = rows.map((row) => ({
      id: row.id,
      content: row.content,
      sender: row.sender,
      senderId: row.sender_id,
      timestamp: row.timestamp,
    }));
    log.info(`Loaded ${messages.length} messages from database`);
  } catch (error) {
    log.error('Failed to load messages:', error);
    messages = [];
  }
}

const insertStmt = db.prepare('INSERT INTO messages (id, content, sender, sender_id, timestamp) VALUES (?, ?, ?, ?, ?)');
const updateSenderStmt = db.prepare('UPDATE messages SET sender = ? WHERE sender_id = ?');
const deleteStmt = db.prepare('DELETE FROM messages WHERE id = ?');
const deleteOldStmt = db.prepare(`DELETE FROM messages WHERE id NOT IN (SELECT id FROM messages ORDER BY rowid DESC LIMIT ?)`);

function trimMessages() {
  if (messages.length <= MAX_MESSAGES) return;
  messages = messages.slice(-TRIM_TO);
  try {
    deleteOldStmt.run(TRIM_TO);
  } catch (error) {
    log.error('Failed to trim messages in database:', error);
  }
}

loadMessages();

router.get('/', (_req, res) => {
  res.json(messages);
});

router.post('/send', (req, res) => {
  const { content, sender, senderId, timestamp } = req.body;
  if (!content || !sender || !senderId) {
    return res.status(400).json({ error: 'Content, sender and senderId are required' });
  }
  if (content.length > 10000) {
    return res.status(400).json({ error: 'Content must be 10000 characters or less' });
  }
  if (sender.length > 50) {
    return res.status(400).json({ error: 'Sender name must be 50 characters or less' });
  }
  if (!content.trim()) {
    return res.status(400).json({ error: 'Content cannot be whitespace-only' });
  }

  const message: Message = {
    id: crypto.randomUUID(),
    content,
    sender,
    senderId,
    timestamp: timestamp || new Date().toISOString(),
  };

  messages.push(message);

  try {
    insertStmt.run(message.id, message.content, message.sender, message.senderId, message.timestamp);
  } catch (error) {
    log.error('Failed to save message:', error);
  }

  trimMessages();

  sse.broadcast(message);

  log.info(`Message sent from ${sender} (${senderId})`);
  res.json(message);
});

router.post('/update-sender', (req, res) => {
  const { senderId, newName } = req.body;
  if (!senderId || !newName) {
    return res.status(400).json({ error: 'senderId and newName are required' });
  }

  let updated = 0;
  messages = messages.map((msg) => {
    if (msg.senderId === senderId) {
      updated++;
      return { ...msg, sender: newName };
    }
    return msg;
  });

  try {
    updateSenderStmt.run(newName, senderId);
  } catch (error) {
    log.error('Failed to update sender:', error);
  }

  sse.broadcast({ type: 'update-sender', senderId, newName });

  log.info(`Sender updated: ${senderId} -> ${newName} (${updated} messages)`);
  res.json({ updated });
});

router.delete('/batch', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Ids array is required' });
  }

  const initialLength = messages.length;
  messages = messages.filter((msg) => !ids.includes(msg.id));

  if (messages.length === initialLength) {
    return res.status(404).json({ error: 'Message not found' });
  }

  const deletedCount = initialLength - messages.length;

  try {
    const batchDelete = db.transaction((idsToDelete: string[]) => {
      for (const id of idsToDelete) {
        deleteStmt.run(id);
      }
    });
    batchDelete(ids);
  } catch (error) {
    log.error('Failed to batch delete messages:', error);
  }

  sse.broadcast({ type: 'delete-batch', ids });

  log.info(`Batch deleted ${deletedCount} messages`);
  res.json({ success: true, deleted: deletedCount });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const initialLength = messages.length;
  messages = messages.filter((msg) => msg.id !== id);

  if (messages.length === initialLength) {
    return res.status(404).json({ error: 'Message not found' });
  }

  try {
    deleteStmt.run(id);
  } catch (error) {
    log.error('Failed to delete message:', error);
  }

  sse.broadcast({ type: 'delete', id });

  log.info(`Message deleted: ${id}`);
  res.json({ success: true });
});

router.get('/stream', (req, res) => {
  sse.addClient(req, res);
});

export { router, messages };
