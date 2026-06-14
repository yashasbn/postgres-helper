import request from 'supertest';
import app from '../src/app.js';

describe('GET /health', () => {
  it('responds with OK', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.text).toBe('OK');
  });
});

describe('POST /api/connectivity-test', () => {
  it('validates required fields', async () => {
    const response = await request(app).post('/api/connectivity-test').send({});
    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
    expect(response.body.error).toMatch(/required/i);
  });

  it('validates port range', async () => {
    const response = await request(app).post('/api/connectivity-test').send({
      host: 'localhost',
      port: 70000,
      database: 'postgres',
      user: 'postgres',
      password: 'secret',
    });
    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
    expect(response.body.error).toMatch(/port/i);
  });

  it('validates timeout range', async () => {
    const response = await request(app).post('/api/connectivity-test').send({
      host: 'localhost',
      database: 'postgres',
      user: 'postgres',
      password: 'secret',
      connectTimeoutMs: 100,
    });
    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
    expect(response.body.error).toMatch(/connectTimeoutMs/i);
  });
});

