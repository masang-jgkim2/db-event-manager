import request from 'supertest';
import app from '../app';
import { fnInitUsers } from '../data/users';

describe('In-app notifications API', () => {
  let strAdminToken: string;

  beforeAll(async () => {
    await fnInitUsers();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ strUserId: 'admin', strPassword: 'admin123' });
    strAdminToken = res.body.strToken;
  });

  it('GET /api/notifications → json 모드는 bPersisted=false', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${strAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.bSuccess).toBe(true);
    expect(res.body.bPersisted).toBe(false);
    expect(res.body.arrNotifications).toEqual([]);
  });

  it('POST /api/notifications → json 모드는 503', async () => {
    const res = await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${strAdminToken}`)
      .send({
        strLevel: 'error',
        strTitle: '테스트',
        strBody: '본문',
      });
    expect(res.status).toBe(503);
    expect(res.body.bSuccess).toBe(false);
  });
});
