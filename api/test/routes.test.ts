import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('../logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const { default: app } = await import('../app.js');

describe('Messages API', () => {
  it('should return messages list', async () => {
    const res = await request(app).get('/api/messages');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should send a message successfully', async () => {
    const res = await request(app)
      .post('/api/messages/send')
      .send({
        content: 'Hello test',
        sender: 'TestUser',
        senderId: 'test-device-001',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.content).toBe('Hello test');
    expect(res.body.sender).toBe('TestUser');
    expect(res.body.senderId).toBe('test-device-001');
  });

  it('should reject message without required fields', async () => {
    const res = await request(app)
      .post('/api/messages/send')
      .send({ content: 'Missing sender' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should delete a message by id', async () => {
    const sendRes = await request(app)
      .post('/api/messages/send')
      .send({
        content: 'To be deleted',
        sender: 'TestUser',
        senderId: 'test-device-002',
      });

    const messageId = sendRes.body.id;

    const deleteRes = await request(app).delete(`/api/messages/${messageId}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
  });

  it('should return 404 when deleting nonexistent message', async () => {
    const res = await request(app).delete('/api/messages/nonexistent-id');
    expect(res.status).toBe(404);
  });

  it('should batch delete messages', async () => {
    const msg1 = await request(app)
      .post('/api/messages/send')
      .send({ content: 'Batch 1', sender: 'Test', senderId: 'batch-test' });

    const msg2 = await request(app)
      .post('/api/messages/send')
      .send({ content: 'Batch 2', sender: 'Test', senderId: 'batch-test' });

    const res = await request(app)
      .delete('/api/messages/batch')
      .send({ ids: [msg1.body.id, msg2.body.id] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should reject batch delete without ids', async () => {
    const res = await request(app)
      .delete('/api/messages/batch')
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('Device Names API', () => {
  const testDeviceId = 'test-device-' + Date.now();

  it('should create a default name for new device', async () => {
    const res = await request(app).get(`/api/device-names/${testDeviceId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('deviceId', testDeviceId);
    expect(res.body).toHaveProperty('name');
    expect(res.body.name).toMatch(/^Device-\d+$/);
  });

  it('should return same name for same device', async () => {
    const res1 = await request(app).get(`/api/device-names/${testDeviceId}`);
    const res2 = await request(app).get(`/api/device-names/${testDeviceId}`);
    expect(res1.body.name).toBe(res2.body.name);
  });

  it('should rename a device', async () => {
    const res = await request(app)
      .post(`/api/device-names/${testDeviceId}`)
      .send({ name: 'MyLaptop' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('MyLaptop');
    expect(res.body).toHaveProperty('oldName');
  });

  it('should reject rename without name', async () => {
    const res = await request(app)
      .post(`/api/device-names/${testDeviceId}`)
      .send({});

    expect(res.status).toBe(400);
  });
});
