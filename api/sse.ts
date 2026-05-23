import express from 'express';
import { createLogger } from './logger.js';

const log = createLogger('sse');

interface SSEClient {
  res: express.Response;
  heartbeat: ReturnType<typeof setInterval>;
  timeout: ReturnType<typeof setTimeout>;
  lastEventId: number;
  connectedAt: Date;
}

const MAX_CLIENTS = 100;
const HEARTBEAT_INTERVAL_MS = 30000;
const CLIENT_TIMEOUT_MS = 90000;

interface SSEManager {
  addClient: (req: express.Request, res: express.Response) => void;
  broadcast: (data: object, eventType?: string) => void;
  getClientCount: () => number;
  getLastEventId: () => number;
}

const managers: Map<string, SSEManager> = new Map();

export function createSSEManager(name: string) {
  const clients: Map<express.Response, SSEClient> = new Map();
  let eventCounter = 0;

  function addClient(req: express.Request, res: express.Response) {
    if (clients.size >= MAX_CLIENTS) {
      log.warn(`[${name}] Max clients (${MAX_CLIENTS}) reached, rejecting new connection`);
      res.status(503).json({ error: 'Too many connections' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const lastEventId = parseInt(req.headers['last-event-id'] as string) || 0;

    const client: SSEClient = {
      res,
      heartbeat: setInterval(() => {
        try {
          res.write(': heartbeat\n\n');
        } catch {
          removeClient(res, 'heartbeat write failed');
        }
      }, HEARTBEAT_INTERVAL_MS),
      timeout: setTimeout(() => {
        removeClient(res, 'connection timeout (no close event)');
      }, CLIENT_TIMEOUT_MS),
      lastEventId,
      connectedAt: new Date(),
    };

    clients.set(res, client);
    log.info(`[${name}] SSE client connected, total: ${clients.size}, lastEventId: ${lastEventId}`);

    req.on('close', () => {
      removeClient(res, 'client disconnected');
    });
  }

  function removeClient(res: express.Response, reason: string) {
    const client = clients.get(res);
    if (!client) return;

    clearInterval(client.heartbeat);
    clearTimeout(client.timeout);
    clients.delete(res);

    try {
      res.end();
    } catch (_e) { /* already closed */ }

    log.info(`[${name}] SSE client removed (${reason}), total: ${clients.size}`);
  }

  function broadcast(data: object, eventType?: string) {
    eventCounter++;
    const eventId = eventCounter;

    const toRemove: express.Response[] = [];

    clients.forEach((client) => {
      try {
        let message = '';
        if (eventType) {
          message += `event: ${eventType}\n`;
        }
        message += `id: ${eventId}\ndata: ${JSON.stringify(data)}\n\n`;
        client.res.write(message);
        client.lastEventId = eventId;

        clearTimeout(client.timeout);
        client.timeout = setTimeout(() => {
          removeClient(client.res, 'connection timeout (no close event)');
        }, CLIENT_TIMEOUT_MS);
      } catch {
        toRemove.push(client.res);
      }
    });

    toRemove.forEach((res) => removeClient(res, 'broadcast write failed'));
  }

  function getClientCount() {
    return clients.size;
  }

  function getLastEventId() {
    return eventCounter;
  }

  const manager = { addClient, broadcast, getClientCount, getLastEventId };
  managers.set(name, manager);
  return manager;
}

export function getSSEStats() {
  const stats: Record<string, { connections: number; lastEventId: number }> = {};
  let totalConnections = 0;
  managers.forEach((mgr, name) => {
    const connections = mgr.getClientCount();
    stats[name] = { connections, lastEventId: mgr.getLastEventId() };
    totalConnections += connections;
  });
  return { totalConnections, channels: stats };
}
