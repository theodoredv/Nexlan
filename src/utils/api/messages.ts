import { Message, SSEMessage } from '../../../shared/types';
import { API_BASE, waitForServer } from './index';

export async function getMessages(): Promise<Message[]> {
  const res = await fetch(`${API_BASE}/messages`);
  if (!res.ok) throw new Error('Failed to get messages');
  return res.json();
}

export async function sendMessage(content: string, sender: string, senderId: string): Promise<Message> {
  const res = await fetch(`${API_BASE}/messages/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, sender, senderId }),
  });
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
}

export function subscribeToMessages(
  onMessage: (message: SSEMessage) => void,
  onReconnect?: () => void
): () => void {
  let closed = false;
  let currentES: EventSource | null = null;
  let delay = 1000;
  const maxDelay = 30000;
  let lastEventId = '';

  function connect() {
    if (closed) return;

    const url = lastEventId
      ? `${API_BASE}/messages/stream?lastEventId=${lastEventId}`
      : `${API_BASE}/messages/stream`;
    const es = new EventSource(url);
    currentES = es;

    es.onopen = () => {
      delay = 1000;
    };

    es.onmessage = (event) => {
      if (event.lastEventId) lastEventId = event.lastEventId;
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      onMessage(data);
    };

    es.onerror = () => {
      es.close();
      currentES = null;
      if (closed) return;

      if (onReconnect) onReconnect();
      delay = Math.min(delay * 2, maxDelay);
      setTimeout(async () => {
        await waitForServer();
        connect();
      }, delay);
    };
  }

  connect();

  return () => {
    closed = true;
    if (currentES) {
      currentES.close();
      currentES = null;
    }
  };
}

export async function deleteMessage(id: string): Promise<{ success: true }> {
  const res = await fetch(`${API_BASE}/messages/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete message');
  return res.json();
}

export async function deleteMessagesBatch(ids: string[]): Promise<{ success: true; deleted: number }> {
  const res = await fetch(`${API_BASE}/messages/batch`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error('Failed to batch delete messages');
  return res.json();
}

export async function updateMessageSender(senderId: string, newName: string): Promise<{ updated: number }> {
  const res = await fetch(`${API_BASE}/messages/update-sender`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senderId, newName }),
  });
  if (!res.ok) throw new Error('Failed to update message sender');
  return res.json();
}
