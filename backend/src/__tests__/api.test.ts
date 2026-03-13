/**
 * API 전체 테스트 — 헬스, 인증, 역할별 API 접근, 권한 추가/삭제에 따른 동작
 */
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app';
import { arrUsers, fnInitUsers } from '../data/users';
import { arrRolePermissions, fnSetPermissionsForRole, fnGetPermissionsByRoleId } from '../data/rolePermissions';
import type { TPermission } from '../types';

// 테스트용 비밀번호 (users.ts 시드와 동일)
const OBJ_PASSWORDS: Record<string, string> = {
  admin: 'admin123',
  gm01:  'gm123',
  dba01: 'dba123',
};

describe('API 전체 테스트', () => {
  let strAdminToken: string;
  let strGmToken: string;
  let strDbaToken: string;

  beforeAll(async () => {
    await fnInitUsers();
    // 테스트에서 사용할 비밀번호로 통일 (저장소 상태와 무관하게 동일 결과 보장)
    const arrSeedPwds = [
      { nId: 1, strPwd: OBJ_PASSWORDS.admin },
      { nId: 2, strPwd: OBJ_PASSWORDS.gm01 },
      { nId: 3, strPwd: OBJ_PASSWORDS.dba01 },
    ];
    for (const { nId, strPwd } of arrSeedPwds) {
      const u = arrUsers.find((x) => x.nId === nId);
      if (u) u.strPassword = await bcrypt.hash(strPwd, 10);
    }
  });

  describe('헬스 체크', () => {
    it('GET /api/health → 200, bSuccess: true', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.bSuccess).toBe(true);
    });
  });

  describe('인증 — 로그인', () => {
    it('관리자(admin) 로그인 → 200, 토큰·arrRoles·arrPermissions 존재', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ strUserId: 'admin', strPassword: OBJ_PASSWORDS.admin });
      expect(res.status).toBe(200);
      expect(res.body.bSuccess).toBe(true);
      expect(res.body.strToken).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(Array.isArray(res.body.user.arrRoles)).toBe(true);
      expect(Array.isArray(res.body.user.arrPermissions)).toBe(true);
      expect(res.body.user.arrRoles).toContain('admin');
      strAdminToken = res.body.strToken;
    });

    it('GM(gm01) 로그인 → 200, arrRoles에 game_manager', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ strUserId: 'gm01', strPassword: OBJ_PASSWORDS.gm01 });
      expect(res.status).toBe(200);
      expect(res.body.user.arrRoles).toContain('game_manager');
      strGmToken = res.body.strToken;
    });

    it('DBA(dba01) 로그인 → 200, arrRoles에 dba', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ strUserId: 'dba01', strPassword: OBJ_PASSWORDS.dba01 });
      expect(res.status).toBe(200);
      expect(res.body.user.arrRoles).toContain('dba');
      strDbaToken = res.body.strToken;
    });

    // DBA: 로그인 응답에 실행 권한(레거시 또는 세분화) 포함
    it('DBA 로그인 → arrPermissions에 execute_qa, execute_live (레거시 또는 세분화) 포함', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ strUserId: 'dba01', strPassword: OBJ_PASSWORDS.dba01 });
      expect(res.status).toBe(200);
      const perms = res.body.user?.arrPermissions ?? [];
      const bHasQa = perms.includes('instance.execute_qa') || perms.includes('my_dashboard.execute_qa');
      const bHasLive = perms.includes('instance.execute_live') || perms.includes('my_dashboard.execute_live');
      expect(bHasQa).toBe(true);
      expect(bHasLive).toBe(true);
      expect(res.body.user.arrRoles).toContain('dba');
    });

    it('잘못된 비밀번호 → 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ strUserId: 'admin', strPassword: 'wrong' });
      expect(res.status).toBe(401);
    });
  });

  describe('토큰 검증', () => {
    it('GET /api/auth/verify (Bearer admin) → 200, user 반환', async () => {
      const res = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${strAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.user.arrRoles).toBeDefined();
      expect(res.body.user.arrPermissions).toBeDefined();
    });

    it('GET /api/auth/verify (Bearer dba) → 200, arrRoles·arrPermissions에 DBA 실행 권한 포함', async () => {
      const res = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${strDbaToken}`);
      expect(res.status).toBe(200);
      expect(res.body.user.arrRoles).toContain('dba');
      const perms = res.body.user?.arrPermissions ?? [];
      const bHasQa = perms.includes('instance.execute_qa') || perms.includes('my_dashboard.execute_qa');
      const bHasLive = perms.includes('instance.execute_live') || perms.includes('my_dashboard.execute_live');
      expect(bHasQa).toBe(true);
      expect(bHasLive).toBe(true);
    });
  });

  describe('관리자 전용 API (admin 토큰)', () => {
    it('GET /api/users → 200', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${strAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.arrUsers).toBeDefined();
    });

    it('GET /api/roles → 200', async () => {
      const res = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${strAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.arrRoles).toBeDefined();
    });

    it('GET /api/db-connections → 200', async () => {
      const res = await request(app)
        .get('/api/db-connections')
        .set('Authorization', `Bearer ${strAdminToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('권한별 API (GM 토큰)', () => {
    it('GET /api/products → 200 (view 권한)', async () => {
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${strGmToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /api/events → 200 (view 권한)', async () => {
      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${strGmToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /api/users → 403 (user.view 없음)', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${strGmToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('권한별 API (DBA 토큰)', () => {
    it('GET /api/event-instances → 200', async () => {
      const res = await request(app)
        .get('/api/event-instances')
        .set('Authorization', `Bearer ${strDbaToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('프로덕트 / 이벤트 (admin)', () => {
    it('GET /api/products → 200, 배열', async () => {
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${strAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.bSuccess).toBe(true);
      expect(Array.isArray(res.body.arrProducts)).toBe(true);
    });

    it('GET /api/events → 200, 배열', async () => {
      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${strAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.bSuccess).toBe(true);
      expect(Array.isArray(res.body.arrEvents)).toBe(true);
    });
  });

  describe('이벤트 인스턴스 (admin)', () => {
    it('GET /api/event-instances → 200', async () => {
      const res = await request(app)
        .get('/api/event-instances')
        .set('Authorization', `Bearer ${strAdminToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('인증 없이 보호된 API → 401', () => {
    it('GET /api/users (토큰 없음) → 401', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(401);
    });
  });

  describe('관리자 CRUD (요약)', () => {
    it('GET /api/roles → arrRoles 배열, 역할 코드 포함', async () => {
      const res = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${strAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.bSuccess).toBe(true);
      const arr = res.body.arrRoles ?? [];
      expect(Array.isArray(arr)).toBe(true);
      const arrCodes = arr.map((r: { strCode?: string }) => r.strCode);
      expect(arrCodes).toContain('admin');
      expect(arrCodes).toContain('dba');
      expect(arrCodes).toContain('game_manager');
      expect(arrCodes).toContain('game_designer');
    });

    it('GET /api/users → arrUsers 배열, arrRoles 포함', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${strAdminToken}`);
      expect(res.status).toBe(200);
      const arr = res.body.arrUsers ?? [];
      expect(Array.isArray(arr)).toBe(true);
      const adminUser = arr.find((u: { strUserId?: string }) => u.strUserId === 'admin');
      expect(adminUser).toBeDefined();
      expect(Array.isArray(adminUser.arrRoles)).toBe(true);
      expect(adminUser.arrRoles).toContain('admin');
    });
  });

  // ─── 권한별 API 접근: 해당 권한 있으면 200, 없으면 403 ───
  describe('권한별 API — 프로덕트 (페이지/메뉴/기능)', () => {
    it('product.view 또는 동등 권한 있으면 GET /api/products → 200', async () => {
      const resAdmin = await request(app).get('/api/products').set('Authorization', `Bearer ${strAdminToken}`);
      const resGm = await request(app).get('/api/products').set('Authorization', `Bearer ${strGmToken}`);
      expect(resAdmin.status).toBe(200);
      expect(resGm.status).toBe(200);
    });

    it('product.view·dashboard.view 없으면 GET /api/products → 403', async () => {
      const N_ROLE_DBA = 2;
      const backup = arrRolePermissions.filter((r) => r.nRoleId === N_ROLE_DBA).map((r) => ({ nRoleId: r.nRoleId, strPermission: r.strPermission }));
      // GET /api/products 허용 권한 전부 제거 (product.*, dashboard.view)
      const arrGetProductPerms = ['product.view', 'product.manage', 'product.create', 'product.edit', 'product.delete', 'dashboard.view'];
      const withoutProductOrDashboard = backup
        .map((p) => p.strPermission)
        .filter((s) => !arrGetProductPerms.includes(s)) as TPermission[];
      fnSetPermissionsForRole(N_ROLE_DBA, withoutProductOrDashboard.length ? withoutProductOrDashboard : ['my_dashboard.view', 'my_dashboard.execute_qa']);
      const loginRes = await request(app).post('/api/auth/login').send({ strUserId: 'dba01', strPassword: OBJ_PASSWORDS.dba01 });
      const res = await request(app).get('/api/products').set('Authorization', `Bearer ${loginRes.body.strToken}`);
      fnSetPermissionsForRole(N_ROLE_DBA, backup.map((p) => p.strPermission as TPermission));
      expect(res.status).toBe(403);
    });

    it('product.create 또는 product.manage 있으면 POST /api/products → 200', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${strAdminToken}`)
        .send({
          strName: '테스트프로덕트',
          strDescription: '권한테스트',
          strDbType: 'mysql',
          arrServices: [{ strAbbr: 'T', strRegion: 'R' }],
        });
      expect(res.status).toBe(200);
    });

    it('product.create 등 없으면 POST /api/products → 403', async () => {
      const N_ROLE_DBA = 2;
      const backup = arrRolePermissions.filter((r) => r.nRoleId === N_ROLE_DBA).map((r) => r.strPermission);
      // product.create, product.manage 제거 후 재로그인해 권한 없는 토큰으로 요청
      const withoutCreate = backup.filter((s) => s !== 'product.create' && s !== 'product.manage') as TPermission[];
      fnSetPermissionsForRole(N_ROLE_DBA, withoutCreate.length ? withoutCreate : ['my_dashboard.view', 'my_dashboard.execute_qa']);
      const loginRes = await request(app).post('/api/auth/login').send({ strUserId: 'dba01', strPassword: OBJ_PASSWORDS.dba01 });
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${loginRes.body.strToken}`)
        .send({ strName: 'X', strDescription: 'X', strDbType: 'mysql', arrServices: [] });
      fnSetPermissionsForRole(N_ROLE_DBA, backup as TPermission[]);
      expect(res.status).toBe(403);
    });
  });

  describe('권한별 API — 이벤트 템플릿', () => {
    it('event_template.view 등 있으면 GET /api/events → 200', async () => {
      const resGm = await request(app).get('/api/events').set('Authorization', `Bearer ${strGmToken}`);
      expect(resGm.status).toBe(200);
    });

    it('event_template.view·dashboard.view 없으면 GET /api/events → 403', async () => {
      const N_ROLE_DBA = 2;
      const backup = arrRolePermissions.filter((r) => r.nRoleId === N_ROLE_DBA).map((r) => ({ nRoleId: r.nRoleId, strPermission: r.strPermission }));
      const withoutEventOrDashboard = backup
        .map((p) => p.strPermission)
        .filter((s) => !s.startsWith('event_template.') && s !== 'dashboard.view') as TPermission[];
      fnSetPermissionsForRole(N_ROLE_DBA, withoutEventOrDashboard.length ? withoutEventOrDashboard : ['my_dashboard.execute_qa', 'my_dashboard.execute_live']);
      const loginRes = await request(app).post('/api/auth/login').send({ strUserId: 'dba01', strPassword: OBJ_PASSWORDS.dba01 });
      const res = await request(app).get('/api/events').set('Authorization', `Bearer ${loginRes.body.strToken}`);
      fnSetPermissionsForRole(N_ROLE_DBA, backup.map((p) => p.strPermission as TPermission));
      expect(res.status).toBe(403);
    });

    it('event_template.create 등 없으면 POST /api/events → 403', async () => {
      const N_ROLE_DBA = 2;
      const backup = arrRolePermissions.filter((r) => r.nRoleId === N_ROLE_DBA).map((r) => ({ nRoleId: r.nRoleId, strPermission: r.strPermission }));
      const withoutCreate = backup.map((p) => p.strPermission).filter((s) => s !== 'event_template.create' && s !== 'event_template.manage') as TPermission[];
      fnSetPermissionsForRole(N_ROLE_DBA, withoutCreate.length ? withoutCreate : ['my_dashboard.execute_qa']);
      const loginRes = await request(app).post('/api/auth/login').send({ strUserId: 'dba01', strPassword: OBJ_PASSWORDS.dba01 });
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${loginRes.body.strToken}`)
        .send({ strName: 'X', strCategory: 'event', strType: 'query', nProductId: 1 });
      fnSetPermissionsForRole(N_ROLE_DBA, backup.map((p) => p.strPermission as TPermission));
      expect(res.status).toBe(403);
    });
  });

  describe('역할·권한별 메뉴/페이지/기능 접근 (API 매트릭스)', () => {
    it('admin: 모든 메뉴 대응 API(보기) 접근 가능', async () => {
      const token = strAdminToken;
      await expect(request(app).get('/api/products').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/events').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/db-connections').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/users').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/roles').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/event-instances').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
    });

    it('GM: 프로덕트·이벤트·이벤트인스턴스 보기 200, 사용자/역할/DB접속 403', async () => {
      const token = strGmToken;
      await expect(request(app).get('/api/products').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/events').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/event-instances').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/users').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 403 });
      await expect(request(app).get('/api/roles').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 403 });
      await expect(request(app).get('/api/db-connections').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 403 });
    });

    it('DBA(실행 권한만 부여 시): 이벤트인스턴스만 200, 나머지 메뉴 API 403', async () => {
      const N_ROLE_DBA = 2;
      const backup = arrRolePermissions.filter((r) => r.nRoleId === N_ROLE_DBA).map((r) => r.strPermission);
      // 나의 대시보드 목록/단건 조회에 my_dashboard.view 필요
      fnSetPermissionsForRole(N_ROLE_DBA, ['my_dashboard.view', 'instance.execute_qa', 'instance.execute_live'] as TPermission[]);
      const loginRes = await request(app).post('/api/auth/login').send({ strUserId: 'dba01', strPassword: OBJ_PASSWORDS.dba01 });
      const token = loginRes.body.strToken;
      await expect(request(app).get('/api/event-instances').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/products').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 403 });
      await expect(request(app).get('/api/events').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 403 });
      await expect(request(app).get('/api/users').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 403 });
      await expect(request(app).get('/api/roles').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 403 });
      await expect(request(app).get('/api/db-connections').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 403 });
      fnSetPermissionsForRole(N_ROLE_DBA, backup as TPermission[]);
    });
  });

  describe('권한별 API — DB 접속 정보', () => {
    it('db.manage 있으면 GET /api/db-connections → 200', async () => {
      const res = await request(app).get('/api/db-connections').set('Authorization', `Bearer ${strAdminToken}`);
      expect(res.status).toBe(200);
    });

    it('db_connection.view만 있으면 GET 200, POST/PUT/DELETE/test 403', async () => {
      const N_ROLE_GM = 3;
      const backup = arrRolePermissions.filter((r) => r.nRoleId === N_ROLE_GM).map((r) => ({ nRoleId: r.nRoleId, strPermission: r.strPermission }));
      fnSetPermissionsForRole(N_ROLE_GM, ['db_connection.view'] as TPermission[]);
      const loginRes = await request(app).post('/api/auth/login').send({ strUserId: 'gm01', strPassword: OBJ_PASSWORDS.gm01 });
      const token = loginRes.body.strToken;
      const getRes = await request(app).get('/api/db-connections').set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(200);
      const list = getRes.body?.arrDbConnections ?? [];
      const nFirstId = list[0]?.nId ?? 1;
      const postRes = await request(app).post('/api/db-connections').set('Authorization', `Bearer ${token}`).send({
        nProductId: 1, strEnv: 'dev', strDbType: 'mssql', strHost: 'x', nPort: 1433, strDatabase: 'x', strUser: 'x', strPassword: 'x',
      });
      expect(postRes.status).toBe(403);
      const putRes = await request(app).put(`/api/db-connections/${nFirstId}`).set('Authorization', `Bearer ${token}`).send({ strHost: 'y' });
      expect(putRes.status).toBe(403);
      const delRes = await request(app).delete(`/api/db-connections/${nFirstId}`).set('Authorization', `Bearer ${token}`);
      expect(delRes.status).toBe(403);
      const testRes = await request(app).post(`/api/db-connections/${nFirstId}/test`).set('Authorization', `Bearer ${token}`);
      expect(testRes.status).toBe(403);
      fnSetPermissionsForRole(N_ROLE_GM, backup.map((p) => p.strPermission as TPermission));
    });

    it('db.manage·db_connection.* 없으면 GET /api/db-connections → 403', async () => {
      // GM은 DB 접속 권한 없음 → 403
      const resGm = await request(app).get('/api/db-connections').set('Authorization', `Bearer ${strGmToken}`);
      expect(resGm.status).toBe(403);
      // (DBA는 현재 데이터에서 db_connection.* 보유 시 200이므로, 권한 제거 후 403 검증)
      const N_ROLE_DBA = 2;
      const backup = arrRolePermissions.filter((r) => r.nRoleId === N_ROLE_DBA).map((r) => ({ nRoleId: r.nRoleId, strPermission: r.strPermission }));
      const withoutDb = backup.map((p) => p.strPermission).filter((s) => s !== 'db.manage' && !s.startsWith('db_connection.')) as TPermission[];
      fnSetPermissionsForRole(N_ROLE_DBA, withoutDb.length ? withoutDb : ['my_dashboard.execute_qa']);
      const loginRes = await request(app).post('/api/auth/login').send({ strUserId: 'dba01', strPassword: OBJ_PASSWORDS.dba01 });
      const resNoDb = await request(app).get('/api/db-connections').set('Authorization', `Bearer ${loginRes.body.strToken}`);
      fnSetPermissionsForRole(N_ROLE_DBA, backup.map((p) => p.strPermission as TPermission));
      expect(resNoDb.status).toBe(403);
    });
  });

  describe('권한별 API — 사용자/역할 (보기 권한)', () => {
    it('user.view 있으면 GET /api/users → 200, role.view 있으면 GET /api/roles → 200', async () => {
      const u = await request(app).get('/api/users').set('Authorization', `Bearer ${strAdminToken}`);
      const r = await request(app).get('/api/roles').set('Authorization', `Bearer ${strAdminToken}`);
      expect(u.status).toBe(200);
      expect(r.status).toBe(200);
    });

    it('user.view 없으면 GET /api/users → 403, role.view 없으면 GET /api/roles → 403', async () => {
      const uGm = await request(app).get('/api/users').set('Authorization', `Bearer ${strGmToken}`);
      const rGm = await request(app).get('/api/roles').set('Authorization', `Bearer ${strGmToken}`);
      expect(uGm.status).toBe(403);
      expect(rGm.status).toBe(403);
    });
  });

  describe('권한별 API — 이벤트 인스턴스 실행', () => {
    it('instance.execute_qa 또는 my_dashboard.execute_qa 등 있으면 POST execute → 200/400/404 (403 아님)', async () => {
      const list = await request(app).get('/api/event-instances').set('Authorization', `Bearer ${strDbaToken}`);
      expect(list.status).toBe(200);
      const nId = list.body?.arrInstances?.[0]?.nId ?? 99999;
      const res = await request(app)
        .post(`/api/event-instances/${nId}/execute`)
        .set('Authorization', `Bearer ${strDbaToken}`)
        .send({ strEnv: 'qa' });
      expect(res.status).not.toBe(403);
      expect([200, 400, 404]).toContain(res.status);
    });

    it('execute 권한 없으면 POST /api/event-instances/:id/execute → 403', async () => {
      const list = await request(app).get('/api/event-instances').set('Authorization', `Bearer ${strGmToken}`);
      const nId = list.body?.arrInstances?.[0]?.nId ?? 99999;
      const res = await request(app)
        .post(`/api/event-instances/${nId}/execute`)
        .set('Authorization', `Bearer ${strGmToken}`)
        .send({ strEnv: 'qa' });
      expect(res.status).toBe(403);
    });
  });

  describe('권한 추가/삭제 시나리오 (역할 권한 변경 후 재로그인)', () => {
    const N_ROLE_GM = 3; // game_manager
    let arrBackupPerms: { nRoleId: number; strPermission: string }[] = [];

    afterEach(() => {
      if (arrBackupPerms.length > 0) {
        fnSetPermissionsForRole(N_ROLE_GM, arrBackupPerms.map((p) => p.strPermission as TPermission));
        arrBackupPerms = [];
      }
    });

    it('프로덕트 권한 제거 시 GET /api/products → 403, 복원 후 재로그인 시 200', async () => {
      arrBackupPerms = arrRolePermissions.filter((r) => r.nRoleId === N_ROLE_GM).map((r) => ({ nRoleId: r.nRoleId, strPermission: r.strPermission }));
      const arrWithoutProduct = arrBackupPerms
        .map((p) => p.strPermission)
        .filter((p) => p !== 'product.view' && p !== 'product.manage') as TPermission[];
      fnSetPermissionsForRole(N_ROLE_GM, arrWithoutProduct);

      const loginRes = await request(app).post('/api/auth/login').send({ strUserId: 'gm01', strPassword: OBJ_PASSWORDS.gm01 });
      expect(loginRes.status).toBe(200);
      const strNewToken = loginRes.body.strToken;

      const resNoPerm = await request(app).get('/api/products').set('Authorization', `Bearer ${strNewToken}`);
      expect(resNoPerm.status).toBe(403);

      fnSetPermissionsForRole(N_ROLE_GM, arrBackupPerms.map((p) => p.strPermission as TPermission));
      const loginRestore = await request(app).post('/api/auth/login').send({ strUserId: 'gm01', strPassword: OBJ_PASSWORDS.gm01 });
      const resRestore = await request(app).get('/api/products').set('Authorization', `Bearer ${loginRestore.body.strToken}`);
      expect(resRestore.status).toBe(200);
    });

    it('db.manage 추가 시 GET /api/db-connections → 200, 제거 후 재로그인 시 403', async () => {
      arrBackupPerms = arrRolePermissions.filter((r) => r.nRoleId === N_ROLE_GM).map((r) => ({ nRoleId: r.nRoleId, strPermission: r.strPermission }));
      const arrWithDb = [...fnGetPermissionsByRoleId(N_ROLE_GM), 'db.manage'] as TPermission[];
      fnSetPermissionsForRole(N_ROLE_GM, arrWithDb);

      const loginRes = await request(app).post('/api/auth/login').send({ strUserId: 'gm01', strPassword: OBJ_PASSWORDS.gm01 });
      expect(loginRes.status).toBe(200);
      const resWithPerm = await request(app).get('/api/db-connections').set('Authorization', `Bearer ${loginRes.body.strToken}`);
      expect(resWithPerm.status).toBe(200);

      const arrWithoutDb = arrBackupPerms.map((p) => p.strPermission).filter((p) => p !== 'db.manage') as TPermission[];
      fnSetPermissionsForRole(N_ROLE_GM, arrWithoutDb);
      const loginNoDb = await request(app).post('/api/auth/login').send({ strUserId: 'gm01', strPassword: OBJ_PASSWORDS.gm01 });
      const resNoPerm = await request(app).get('/api/db-connections').set('Authorization', `Bearer ${loginNoDb.body.strToken}`);
      expect(resNoPerm.status).toBe(403);
    });
  });
});
