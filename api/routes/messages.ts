import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Message } from '../../shared/types';
import { createLogger } from '../logger.js';
import { createSSEManager } from '../sse.js';

const log = createLogger('messages');
const sse = createSSEManager('messages');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '../..');

const router = express.Router();

const dataDir = path.join(projectRoot, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const messagesPath = path.join(dataDir, 'messages.json');

let messages: Message[] = [];

function loadMessages() {
  if (fs.existsSync(messagesPath)) {
    try {
      const data = fs.readFileSync(messagesPath, 'utf-8');
      messages = JSON.parse(data);
      log.info(`Loaded ${messages.length} messages from disk`);
    } catch (error) {
      log.error('Failed to load messages:', error);
      messages = [];
    }
  }
}

function saveMessages() {
  try {
    fs.writeFileSync(messagesPath, JSON.stringify(messages, null, 2));
  } catch (error) {
    log.error('Failed to save messages:', error);
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

  const message: Message = {
    id: Date.now().toString(),
    content,
    sender,
    senderId,
    timestamp: timestamp || new Date().toISOString(),
  };

  messages.push(message);
  if (messages.length > 100) {
    messages = messages.slice(-50);
  }

  saveMessages();

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

  saveMessages();

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
  saveMessages();
  
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
  
  saveMessages();
  
  sse.broadcast({ type: 'delete', id });
  
  log.info(`Message deleted: ${id}`);
  res.json({ success: true });
});

router.get('/stream', (req, res) => {
  sse.addClient(req, res);
});

export { router, messages };
