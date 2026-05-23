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

describe('Health Check', () => {
  it('should return ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('memory');
    expect(res.body).toHaveProperty('disk');
    expect(res.body).toHaveProperty('sse');
  });
});

describe('Network API', () => {
  it('should return network info with ip, port, url', async () => {
    const res = await request(app).get('/api/network');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ip');
    expect(res.body).toHaveProperty('port');
    expect(res.body).toHaveProperty('url');
    expect(typeof res.body.ip).toBe('string');
    expect(typeof res.body.port).toBe('number');
    expect(typeof res.body.url).toBe('string');
  });

  it('should respect x-forwarded headers', async () => {
    const res = await request(app)
      .get('/api/network')
      .set('X-Forwarded-Host', 'myhost:8080')
      .set('X-Forwarded-Proto', 'https');

    expect(res.status).toBe(200);
    expect(res.body.port).toBe(8080);
    expect(res.body.url).toBe('https://myhost:8080');
  });
});

describe('404 Handler', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'API not found' });
  });
});
