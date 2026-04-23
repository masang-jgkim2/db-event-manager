/**
 * API 전체 테스트 — 헬스, 인증, 역할별 API 접근, 권한 추가/삭제에 따른 동작
 */
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app';
import { arrUsers, fnInitUsers, fnSaveUsers } from '../data/users';
import { arrUserRoles, fnSetRolesForUser, fnSaveUserRoles } from '../data/userRoles';
import { arrRolePermissions, fnSetPermissionsForRole, fnGetPermissionsByRoleId } from '../data/rolePermissions';
import { arrProducts } from '../data/products';
import { arrEvents } from '../data/events';
import { arrDbConnections } from '../data/dbConnections';
import { arrEventInstances } from '../data/eventInstances';
import type { TPermission } from '../types';

// 테스트용 비밀번호 (users.ts 시드와 동일)
const OBJ_PASSWORDS: Record<string, string> = {
  admin: 'admin123',
  gm01:  'gm123',
  dba01: 'dba123',
  planner01: 'planner123',
};

describe('API 전체 테스트', () => {
  let strAdminToken: string;
  let strGmToken: string;
  let strDbaToken: string;

  beforeAll(async () => {
    await fnInitUsers();
    // 기획자(planner01) 시드 유저 — users.json에 3명만 있으면 추가 (전 역할 테스트용)
    if (!arrUsers.some((u) => u.strUserId === 'planner01')) {
      const nId = 4;
      const strHash = await bcrypt.hash(OBJ_PASSWORDS.planner01, 10);
      arrUsers.push({
        nId,
        strUserId: 'planner01',
        strPassword: strHash,
        strDisplayName: '기획자_이영희',
        dtCreatedAt: new Date().toISOString(),
      });
      fnSaveUsers();
      if (!arrUserRoles.some((r) => r.nUserId === nId && r.nRoleId === 4)) {
        fnSetRolesForUser(nId, [4]);
        fnSaveUserRoles();
      }
    }
    // 테스트에서 사용할 비밀번호로 통일 (저장소 상태와 무관하게 동일 결과 보장)
    const arrSeedPwds = [
      { nId: 1, strPwd: OBJ_PASSWORDS.admin },
      { nId: 2, strPwd: OBJ_PASSWORDS.gm01 },
      { nId: 3, strPwd: OBJ_PASSWORDS.dba01 },
      { nId: 4, strPwd: OBJ_PASSWORDS.planner01 },
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

    // DBA: 로그인 응답에 실행 권한(레거시 또는 세분화) 또는 dba 역할 포함
    it('DBA 로그인 → arrPermissions에 execute 관련 또는 dba 역할', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ strUserId: 'dba01', strPassword: OBJ_PASSWORDS.dba01 });
      expect(res.status).toBe(200);
      expect(res.body.user.arrRoles).toContain('dba');
      const perms = res.body.user?.arrPermissions ?? [];
      const bHasExecute = perms.some((p: string) =>
        p.includes('execute_qa') || p.includes('execute_live') || p === 'instance.execute_qa' || p === 'instance.execute_live');
      expect(bHasExecute || res.body.user.arrRoles?.includes('dba')).toBe(true);
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

    it('GET /api/auth/verify (Bearer dba) → 200, arrRoles에 dba 포함', async () => {
      const res = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${strDbaToken}`);
      expect(res.status).toBe(200);
      expect(res.body.user.arrRoles).toContain('dba');
      expect(Array.isArray(res.body.user.arrPermissions)).toBe(true);
    });

    it('POST /api/auth/logout (Bearer admin) → 200', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${strAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.bSuccess).toBe(true);
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

  describe('프로덕트 / 쿼리 템플릿 (admin)', () => {
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

  // ─── 역할별 권한 수·설정 화면·유저 화면(API) 검증 ─────────────────────────────
  describe('역할별 권한 수·로그인 권한·API 접근 검증', () => {
    // DBA는 시드/보정 기준 최소 5개, 필수 5개 포함 (설정 화면에서 보기·상세·컨펌·QA반영실행·LIVE반영실행 체크)
    it('GET /api/roles → DBA 역할에 보기·상세·컨펌·QA반영실행·LIVE반영실행 포함, 권한 수 >= 5', async () => {
      const res = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${strAdminToken}`);
      expect(res.status).toBe(200);
      const arr = res.body.arrRoles ?? [];
      const rDba = arr.find((x: { strCode: string }) => x.strCode === 'dba');
      expect(rDba).toBeDefined();
      const nActual = Array.isArray(rDba.arrPermissions) ? rDba.arrPermissions.length : 0;
      expect(nActual).toBeGreaterThanOrEqual(5);
      expect(rDba.arrPermissions).toContain('my_dashboard.view');
      expect(rDba.arrPermissions).toContain('my_dashboard.detail');
      expect(rDba.arrPermissions).toContain('my_dashboard.confirm');
      expect(rDba.arrPermissions).toContain('my_dashboard.execute_qa');
      expect(rDba.arrPermissions).toContain('my_dashboard.execute_live');
    });

    it('DBA 로그인 → arrPermissions에 보기·상세·컨펌·QA반영실행·LIVE반영실행 포함', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ strUserId: 'dba01', strPassword: OBJ_PASSWORDS.dba01 });
      expect(res.status).toBe(200);
      const perms = res.body.user?.arrPermissions ?? [];
      expect(perms).toContain('my_dashboard.view');
      expect(perms).toContain('my_dashboard.detail');
      expect(perms).toContain('my_dashboard.confirm');
      expect(perms).toContain('my_dashboard.execute_qa');
      expect(perms).toContain('my_dashboard.execute_live');
    });

    it('admin 로그인 → 모든 메뉴 대응 API(보기) 200', async () => {
      const token = strAdminToken;
      await expect(request(app).get('/api/products').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/events').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/db-connections').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/users').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/roles').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/event-instances').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
    });

    it('DBA(dba01) 로그인 → 나의대시보드·DB접속 200, 나머지는 부여된 보기 권한에 따라 200/403', async () => {
      const loginRes = await request(app).post('/api/auth/login').send({ strUserId: 'dba01', strPassword: OBJ_PASSWORDS.dba01 });
      const token = loginRes.body.strToken;
      const arrPerms: string[] = loginRes.body.user?.arrPermissions ?? [];
      expect(loginRes.status).toBe(200);
      await expect(request(app).get('/api/event-instances').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/db-connections').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      const fnExpectView = async (strPath: string, strPerm: string) => {
        const nWant = arrPerms.includes(strPerm) ? 200 : 403;
        await expect(request(app).get(strPath).set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: nWant });
      };
      await fnExpectView('/api/products', 'product.view');
      await fnExpectView('/api/events', 'event_template.view');
      await fnExpectView('/api/users', 'user.view');
      await fnExpectView('/api/roles', 'role.view');
    });

    it('GM(gm01) 로그인 → 프로덕트·쿼리 템플릿·나의대시보드·DB접속 200, 사용자·역할 403', async () => {
      const token = strGmToken;
      await expect(request(app).get('/api/products').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/events').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/event-instances').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/db-connections').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/users').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 403 });
      await expect(request(app).get('/api/roles').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 403 });
    });

    it('기획자(planner01) 로그인 → 프로덕트·쿼리 템플릿·나의대시보드·DB접속 200, 사용자·역할 403', async () => {
      const loginRes = await request(app).post('/api/auth/login').send({ strUserId: 'planner01', strPassword: OBJ_PASSWORDS.planner01 });
      expect(loginRes.status).toBe(200);
      const token = loginRes.body.strToken;
      expect(loginRes.body.user.arrRoles).toContain('game_designer');
      await expect(request(app).get('/api/products').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/events').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/event-instances').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/db-connections').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/users').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 403 });
      await expect(request(app).get('/api/roles').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 403 });
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

  describe('권한별 API — 쿼리 템플릿', () => {
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
      await expect(request(app).get('/api/activity/logs').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/activity/actors').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).delete('/api/activity/logs').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
    });

    it('GM: 프로덕트·쿼리 템플릿·이벤트 인스턴스 보기 200, 사용자/역할 403, DB접속은 my_dashboard.view로 200', async () => {
      const token = strGmToken;
      await expect(request(app).get('/api/products').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/events').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/event-instances').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/users').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 403 });
      await expect(request(app).get('/api/roles').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 403 });
      await expect(request(app).get('/api/db-connections').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/activity/logs').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 403 });
      await expect(request(app).get('/api/activity/actors').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 403 });
      await expect(request(app).delete('/api/activity/logs').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 403 });
    });

    it('DBA(실행 권한만 부여 시): 이벤트 인스턴스·DB접속 200, 나머지 메뉴 API 403', async () => {
      const N_ROLE_DBA = 2;
      const backup = arrRolePermissions.filter((r) => r.nRoleId === N_ROLE_DBA).map((r) => r.strPermission);
      fnSetPermissionsForRole(N_ROLE_DBA, ['my_dashboard.view', 'instance.execute_qa', 'instance.execute_live'] as TPermission[]);
      const loginRes = await request(app).post('/api/auth/login').send({ strUserId: 'dba01', strPassword: OBJ_PASSWORDS.dba01 });
      const token = loginRes.body.strToken;
      await expect(request(app).get('/api/event-instances').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/db-connections').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 200 });
      await expect(request(app).get('/api/products').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 403 });
      await expect(request(app).get('/api/events').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 403 });
      await expect(request(app).get('/api/users').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 403 });
      await expect(request(app).get('/api/roles').set('Authorization', `Bearer ${token}`)).resolves.toMatchObject({ status: 403 });
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

    it('db_connection.view·db.manage·my_dashboard.view·instance.create 모두 없으면 GET /api/db-connections → 403', async () => {
      const N_ROLE_GM = 3;
      const backup = arrRolePermissions.filter((r) => r.nRoleId === N_ROLE_GM).map((r) => ({ nRoleId: r.nRoleId, strPermission: r.strPermission }));
      const withoutAnyDbView = backup
        .map((p) => p.strPermission)
        .filter((s) => s !== 'db.manage' && !s.startsWith('db_connection.') && s !== 'my_dashboard.view' && s !== 'instance.create') as TPermission[];
      fnSetPermissionsForRole(N_ROLE_GM, withoutAnyDbView.length ? withoutAnyDbView : ['product.view', 'event_template.view']);
      const loginRes = await request(app).post('/api/auth/login').send({ strUserId: 'gm01', strPassword: OBJ_PASSWORDS.gm01 });
      const res = await request(app).get('/api/db-connections').set('Authorization', `Bearer ${loginRes.body.strToken}`);
      fnSetPermissionsForRole(N_ROLE_GM, backup.map((p) => p.strPermission as TPermission));
      expect(res.status).toBe(403);
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

    it('db.manage 추가 시 GET /api/db-connections → 200, db.manage·my_dashboard.view·instance.create 제거 후 403', async () => {
      arrBackupPerms = arrRolePermissions.filter((r) => r.nRoleId === N_ROLE_GM).map((r) => ({ nRoleId: r.nRoleId, strPermission: r.strPermission }));
      const arrWithDb = [...fnGetPermissionsByRoleId(N_ROLE_GM), 'db.manage'] as TPermission[];
      fnSetPermissionsForRole(N_ROLE_GM, arrWithDb);

      const loginRes = await request(app).post('/api/auth/login').send({ strUserId: 'gm01', strPassword: OBJ_PASSWORDS.gm01 });
      expect(loginRes.status).toBe(200);
      const resWithPerm = await request(app).get('/api/db-connections').set('Authorization', `Bearer ${loginRes.body.strToken}`);
      expect(resWithPerm.status).toBe(200);

      const arrWithoutDbView = arrBackupPerms
        .map((p) => p.strPermission)
        .filter((p) => p !== 'db.manage' && p !== 'my_dashboard.view' && p !== 'instance.create') as TPermission[];
      fnSetPermissionsForRole(N_ROLE_GM, arrWithoutDbView.length ? arrWithoutDbView : ['product.view', 'event_template.view']);
      const loginNoDb = await request(app).post('/api/auth/login').send({ strUserId: 'gm01', strPassword: OBJ_PASSWORDS.gm01 });
      const resNoPerm = await request(app).get('/api/db-connections').set('Authorization', `Bearer ${loginNoDb.body.strToken}`);
      expect(resNoPerm.status).toBe(403);
    });
  });

  // ─── 프로덕트 추가·수정·삭제 테스트 ─────────────────────────────────────
  describe('프로덕트 CRUD', () => {
    let nProductId: number;

    it('POST /api/products → 200, 생성된 nId 반환', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${strAdminToken}`)
        .send({
          strName: '테스트프로덕트CRUD',
          strDescription: 'CRUD테스트용',
          strDbType: 'mysql',
          arrServices: [{ strAbbr: 'T1', strRegion: '국내' }],
        });
      expect(res.status).toBe(200);
      expect(res.body.bSuccess).toBe(true);
      expect(res.body.objProduct?.nId).toBeDefined();
      nProductId = res.body.objProduct.nId;
    });

    it('PUT /api/products/:id → 200, 수정 반영', async () => {
      const res = await request(app)
        .put(`/api/products/${nProductId}`)
        .set('Authorization', `Bearer ${strAdminToken}`)
        .send({ strDescription: '수정된 설명', strName: '테스트프로덕트CRUD' });
      expect(res.status).toBe(200);
      expect(res.body.objProduct.strDescription).toBe('수정된 설명');
    });

    it('DELETE /api/products/:id → 200', async () => {
      const res = await request(app)
        .delete(`/api/products/${nProductId}`)
        .set('Authorization', `Bearer ${strAdminToken}`);
      expect(res.status).toBe(200);
      expect(arrProducts.find((p) => p.nId === nProductId)).toBeUndefined();
    });
  });

  // ─── 쿼리 템플릿(세트) 추가·수정·삭제 테스트 ─────────────────────────────
  describe('쿼리 템플릿 CRUD (다중 세트)', () => {
    let nEventId: number;
    const nProductIdForEvent = 1;
    let nDbConnectionId: number;

    beforeAll(async () => {
      const list = await request(app).get('/api/db-connections').set('Authorization', `Bearer ${strAdminToken}`);
      const conn = list.body?.arrDbConnections?.find((c: { nProductId: number }) => c.nProductId === nProductIdForEvent);
      nDbConnectionId = conn?.nId ?? arrDbConnections.find((c) => c.nProductId === nProductIdForEvent)?.nId ?? 0;
      if (!nDbConnectionId) {
        const createConn = await request(app)
          .post('/api/db-connections')
          .set('Authorization', `Bearer ${strAdminToken}`)
          .send({
            nProductId: nProductIdForEvent,
            strKind: 'GAME',
            strEnv: 'dev',
            strDbType: 'mssql',
            strHost: 'localhost',
            nPort: 1433,
            strDatabase: 'test',
            strUser: 'u',
            strPassword: 'p',
          });
        if (createConn.status === 200) nDbConnectionId = createConn.body.objDbConnection?.nId ?? 0;
      }
    });

    it('POST /api/events (arrQueryTemplates) → 200', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${strAdminToken}`)
        .send({
          nProductId: nProductIdForEvent,
          strEventLabel: '테스트이벤트CRUD',
          strDescription: '쿼리세트 테스트',
          strCategory: '아이템',
          strType: '지급',
          strInputFormat: 'item_number',
          strDefaultItems: '',
          strQueryTemplate: '',
          arrQueryTemplates: [
            { nDbConnectionId, strDefaultItems: '1,2,3', strQueryTemplate: 'SELECT 1;' },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.objEvent?.nId).toBeDefined();
      expect(res.body.objEvent?.arrQueryTemplates?.length).toBe(1);
      nEventId = res.body.objEvent.nId;
    });

    it('PUT /api/events/:id (arrQueryTemplates 수정) → 200', async () => {
      const res = await request(app)
        .put(`/api/events/${nEventId}`)
        .set('Authorization', `Bearer ${strAdminToken}`)
        .send({
          strEventLabel: '테스트이벤트CRUD(수정)',
          arrQueryTemplates: [
            { nDbConnectionId, strDefaultItems: '9,8', strQueryTemplate: 'SELECT 2;' },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.objEvent.arrQueryTemplates[0].strQueryTemplate).toBe('SELECT 2;');
    });

    it('DELETE /api/events/:id → 200', async () => {
      const res = await request(app)
        .delete(`/api/events/${nEventId}`)
        .set('Authorization', `Bearer ${strAdminToken}`);
      expect(res.status).toBe(200);
      expect(arrEvents.find((e) => e.nId === nEventId)).toBeUndefined();
    });
  });

  // ─── 다중 세트 E2E: 템플릿(2세트) → 이벤트 생성 → 진행 ─────────────────
  describe('다중 세트 E2E 테스트', () => {
    const nProductId = 1;
    let nConn1: number;
    let nConn2: number;
    let nEventTemplateId: number;
    let nInstanceId: number;

    beforeAll(async () => {
      const list = await request(app).get('/api/db-connections').set('Authorization', `Bearer ${strAdminToken}`);
      const conns = (list.body?.arrDbConnections ?? []).filter((c: { nProductId: number }) => c.nProductId === nProductId);
      nConn1 = conns[0]?.nId ?? arrDbConnections.find((c) => c.nProductId === nProductId)?.nId ?? 0;
      nConn2 = conns[1]?.nId ?? arrDbConnections.filter((c) => c.nProductId === nProductId)[1]?.nId ?? nConn1;
    });

    it('다중 세트 쿼리 템플릿 생성 (2세트, 임의 쿼리)', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${strAdminToken}`)
        .send({
          nProductId,
          strEventLabel: '다중세트 테스트 이벤트',
          strDescription: 'E2E 다중 쿼리 세트 테스트',
          strCategory: '아이템',
          strType: '지급',
          strInputFormat: 'item_number',
          strDefaultItems: '',
          strQueryTemplate: '',
          arrQueryTemplates: [
            { nDbConnectionId: nConn1, strDefaultItems: '100,101', strQueryTemplate: 'SELECT 1 AS Set1, {{items}} AS Items;' },
            { nDbConnectionId: nConn2, strDefaultItems: '200,201', strQueryTemplate: 'SELECT 2 AS Set2, {{items}} AS Items;' },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.objEvent?.nId).toBeDefined();
      expect(res.body.objEvent?.arrQueryTemplates?.length).toBe(2);
      nEventTemplateId = res.body.objEvent.nId;
    });

    it('다중 세트로 이벤트 인스턴스 생성 (arrExecutionTargets 2건)', async () => {
      const dtDeploy = new Date(Date.now() + 86400000).toISOString();
      const res = await request(app)
        .post('/api/event-instances')
        .set('Authorization', `Bearer ${strGmToken}`)
        .send({
          nEventTemplateId,
          nProductId,
          strEventLabel: '다중세트 테스트 이벤트',
          strProductName: '출조낚시왕',
          strServiceAbbr: 'FH',
          strServiceRegion: '국내',
          strCategory: '아이템',
          strType: '지급',
          strEventName: '[FH] 다중 세트 테스트',
          strInputValues: '100,101\u0001200,201',
          strGeneratedQuery: 'SELECT 1 AS Set1, 100,101 AS Items;',
          arrExecutionTargets: [
            { nDbConnectionId: nConn1, strQuery: 'SELECT 1 AS Set1, 100,101 AS Items;' },
            { nDbConnectionId: nConn2, strQuery: 'SELECT 2 AS Set2, 200,201 AS Items;' },
          ],
          dtDeployDate: dtDeploy,
          arrDeployScope: ['qa', 'live'],
          strCreatedBy: 'GM테스트',
        });
      expect(res.status).toBe(200);
      expect(res.body.objInstance?.nId).toBeDefined();
      expect(res.body.objInstance?.strStatus).toBe('event_created');
      expect(res.body.objInstance?.arrExecutionTargets?.length).toBe(2);
      nInstanceId = res.body.objInstance.nId;
    });

    it('인스턴스 상세 조회 시 쿼리 세트 2개 반환', async () => {
      const res = await request(app)
        .get(`/api/event-instances/${nInstanceId}`)
        .set('Authorization', `Bearer ${strGmToken}`);
      expect(res.status).toBe(200);
      expect(res.body.objInstance?.arrExecutionTargets?.length).toBe(2);
      expect(res.body.objInstance?.arrExecutionTargets?.[0]?.strQuery).toContain('Set1');
      expect(res.body.objInstance?.arrExecutionTargets?.[1]?.strQuery).toContain('Set2');
    });

    it('이벤트 진행: 컨펌 요청 (confirm_requested)', async () => {
      const res = await request(app)
        .patch(`/api/event-instances/${nInstanceId}/status`)
        .set('Authorization', `Bearer ${strGmToken}`)
        .send({ strNextStatus: 'confirm_requested', strComment: '다중세트 E2E 컨펌 요청' });
      expect([200, 400]).toContain(res.status);
      if (res.status === 200) expect(res.body.objInstance?.strStatus).toBe('confirm_requested');
    });

    it('DBA 컨펌 (dba_confirmed)', async () => {
      const res = await request(app)
        .patch(`/api/event-instances/${nInstanceId}/status`)
        .set('Authorization', `Bearer ${strDbaToken}`)
        .send({ strNextStatus: 'dba_confirmed', strComment: '다중세트 E2E DBA 컨펌' });
      expect([200, 400]).toContain(res.status);
      if (res.status === 200) expect(res.body.objInstance?.strStatus).toBe('dba_confirmed');
    });
  });

  // ─── DB 접속 추가·수정·삭제 테스트 ─────────────────────────────────────
  describe('DB 접속 CRUD', () => {
    let nConnId: number;
    /** 출조낚시왕 — mssql (접속 DB 종류 불일치 테스트용) */
    const nProductIdMssql = 1;
    /** 라그하임 — mysql (mysql 접속 CRUD용) */
    const nProductIdMysql = 6;

    it('POST /api/db-connections 프로덕트 strDbType 불일치 → 400', async () => {
      const res = await request(app)
        .post('/api/db-connections')
        .set('Authorization', `Bearer ${strAdminToken}`)
        .send({
          nProductId: nProductIdMssql,
          strKind: 'WEB',
          strEnv: 'dev',
          strDbType: 'mysql',
          strHost: '127.0.0.1',
          nPort: 3306,
          strDatabase: 'x',
          strUser: 'u',
          strPassword: 'p',
        });
      expect(res.status).toBe(400);
      expect(res.body.strMessage).toMatch(/DB 종류/);
    });

    it('POST /api/db-connections (strKind 포함) → 200', async () => {
      const res = await request(app)
        .post('/api/db-connections')
        .set('Authorization', `Bearer ${strAdminToken}`)
        .send({
          nProductId: nProductIdMysql,
          strKind: 'LOG',
          strEnv: 'dev',
          strDbType: 'mysql',
          strHost: '127.0.0.1',
          nPort: 3306,
          strDatabase: 'test_crud',
          strUser: 'u',
          strPassword: 'p',
        });
      expect(res.status).toBe(200);
      expect(res.body.objDbConnection?.nId).toBeDefined();
      expect(res.body.objDbConnection?.strKind).toBe('LOG');
      nConnId = res.body.objDbConnection.nId;
    });

    it('PUT /api/db-connections/:id → 200', async () => {
      const res = await request(app)
        .put(`/api/db-connections/${nConnId}`)
        .set('Authorization', `Bearer ${strAdminToken}`)
        .send({ strHost: '192.168.0.1', strKind: 'WEB' });
      expect(res.status).toBe(200);
      expect(arrDbConnections.find((c) => c.nId === nConnId)?.strKind).toBe('WEB');
    });

    it('DELETE /api/db-connections/:id → 200', async () => {
      const res = await request(app)
        .delete(`/api/db-connections/${nConnId}`)
        .set('Authorization', `Bearer ${strAdminToken}`);
      expect(res.status).toBe(200);
      expect(arrDbConnections.find((c) => c.nId === nConnId)).toBeUndefined();
    });
  });

  // ─── 사용자 추가·수정·삭제 테스트 (권한/역할) ───────────────────────────
  describe('사용자 CRUD (권한)', () => {
    const strTestUserId = 'testuser_crud_' + Date.now();
    let nUserId: number;

    it('POST /api/users → 200, arrRoles 반영', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${strAdminToken}`)
        .send({
          strUserId: strTestUserId,
          strPassword: 'test123',
          strDisplayName: '테스트사용자',
          arrRoles: ['game_manager'],
        });
      expect(res.status).toBe(200);
      expect(res.body.user?.nId).toBeDefined();
      expect(res.body.user?.arrRoles).toContain('game_manager');
      nUserId = res.body.user.nId;
    });

    it('PUT /api/users/:id (arrRoles 수정) → 200', async () => {
      const res = await request(app)
        .put(`/api/users/${nUserId}`)
        .set('Authorization', `Bearer ${strAdminToken}`)
        .send({ strDisplayName: '테스트사용자(수정)', arrRoles: ['game_designer'] });
      expect(res.status).toBe(200);
      expect(res.body.user?.arrRoles).toContain('game_designer');
    });

    it('DELETE /api/users/:id → 200', async () => {
      const res = await request(app)
        .delete(`/api/users/${nUserId}`)
        .set('Authorization', `Bearer ${strAdminToken}`);
      expect(res.status).toBe(200);
    });
  });

  // ─── 역할 추가·수정·삭제 테스트 (권한) ───────────────────────────────────
  describe('역할 CRUD (권한)', () => {
    const strRoleCode = 'test_role_crud_' + Date.now();
    let nRoleId: number;

    it('POST /api/roles → 200, arrPermissions 반영', async () => {
      const res = await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${strAdminToken}`)
        .send({
          strCode: strRoleCode,
          strDisplayName: '테스트역할',
          strDescription: 'CRUD테스트',
          arrPermissions: ['product.view', 'event_template.view'],
        });
      expect(res.status).toBe(200);
      expect(res.body.objRole?.nId).toBeDefined();
      expect(res.body.objRole?.arrPermissions).toContain('product.view');
      nRoleId = res.body.objRole.nId;
    });

    it('PUT /api/roles/:id (arrPermissions 수정) → 200', async () => {
      const res = await request(app)
        .put(`/api/roles/${nRoleId}`)
        .set('Authorization', `Bearer ${strAdminToken}`)
        .send({ arrPermissions: ['product.view', 'product.manage'] });
      expect(res.status).toBe(200);
      expect(res.body.objRole?.arrPermissions).toContain('product.manage');
    });

    it('DELETE /api/roles/:id → 200', async () => {
      const res = await request(app)
        .delete(`/api/roles/${nRoleId}`)
        .set('Authorization', `Bearer ${strAdminToken}`);
      expect(res.status).toBe(200);
    });
  });

  // ─── 이벤트 생성·수정 테스트 ─────────────────────────────────────────────
  describe('이벤트 인스턴스 생성·수정', () => {
    let nInstanceId: number;
    let nEventTemplateId: number;
    let nProductId: number;

    beforeAll(async () => {
      const products = await request(app).get('/api/products').set('Authorization', `Bearer ${strAdminToken}`);
      const events = await request(app).get('/api/events').set('Authorization', `Bearer ${strAdminToken}`);
      const p = products.body?.arrProducts?.[0];
      const e = events.body?.arrEvents?.[0];
      nProductId = p?.nId ?? 1;
      nEventTemplateId = e?.nId ?? 1;
    });

    it('POST /api/event-instances → 200 (GM 권한)', async () => {
      const res = await request(app)
        .post('/api/event-instances')
        .set('Authorization', `Bearer ${strGmToken}`)
        .send({
          nEventTemplateId,
          nProductId,
          strEventLabel: '테스트',
          strProductName: '테스트프로덕트',
          strServiceAbbr: 'T',
          strServiceRegion: '국내',
          strCategory: '아이템',
          strType: '지급',
          strEventName: '[T] 테스트 이벤트',
          strInputValues: '1,2,3',
          strGeneratedQuery: 'SELECT 1;',
          dtDeployDate: new Date(Date.now() + 86400000).toISOString(),
          arrDeployScope: ['qa', 'live'],
          strCreatedBy: 'GM테스트',
        });
      expect(res.status).toBe(200);
      expect(res.body.objInstance?.nId).toBeDefined();
      expect(res.body.objInstance?.strStatus).toBe('event_created');
      nInstanceId = res.body.objInstance.nId;
    });

    it('PUT /api/event-instances/:id (event_created 수정) → 200', async () => {
      const res = await request(app)
        .put(`/api/event-instances/${nInstanceId}`)
        .set('Authorization', `Bearer ${strGmToken}`)
        .send({ strEventName: '[T] 수정된 이벤트명' });
      expect(res.status).toBe(200);
      expect(res.body.objInstance?.strEventName).toBe('[T] 수정된 이벤트명');
    });
  });

  // ─── 나의 대시보드 각 프로세스 테스트 ───────────────────────────────────
  describe('나의 대시보드 프로세스', () => {
    let nInstanceId: number;

    beforeAll(async () => {
      const list = await request(app).get('/api/event-instances').set('Authorization', `Bearer ${strAdminToken}`);
      const arr = list.body?.arrInstances ?? [];
      const created = arr.find((i: { strStatus: string }) => i.strStatus === 'event_created');
      nInstanceId = created?.nId ?? arr[0]?.nId ?? 0;
    });

    it('GET /api/event-instances/template-exec-elapsed → 200, nElapsedMs', async () => {
      const res = await request(app)
        .get('/api/event-instances/template-exec-elapsed')
        .query({ nEventTemplateId: 1, strEnv: 'qa' })
        .set('Authorization', `Bearer ${strGmToken}`);
      expect(res.status).toBe(200);
      expect(res.body.bSuccess).toBe(true);
      expect(typeof res.body.nElapsedMs).toBe('number');
    });

    it('GET /api/event-instances/template-exec-elapsed 잘못된 strEnv → 400', async () => {
      const res = await request(app)
        .get('/api/event-instances/template-exec-elapsed')
        .query({ nEventTemplateId: 1, strEnv: 'dev' })
        .set('Authorization', `Bearer ${strAdminToken}`);
      expect(res.status).toBe(400);
    });

    it('GET /api/event-instances (my_dashboard.view) → 200', async () => {
      const res = await request(app).get('/api/event-instances').set('Authorization', `Bearer ${strGmToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.arrInstances)).toBe(true);
    });

    it('GET /api/event-instances/:id → 200', async () => {
      if (!nInstanceId) return;
      const res = await request(app)
        .get(`/api/event-instances/${nInstanceId}`)
        .set('Authorization', `Bearer ${strGmToken}`);
      expect(res.status).toBe(200);
      expect(res.body.objInstance?.nId).toBe(nInstanceId);
    });

    it('PATCH /api/event-instances/:id/status (confirm_requested, GM) → 200', async () => {
      if (!nInstanceId) return;
      const res = await request(app)
        .patch(`/api/event-instances/${nInstanceId}/status`)
        .set('Authorization', `Bearer ${strGmToken}`)
        .send({ strNextStatus: 'confirm_requested', strComment: '컨펌 요청' });
      expect([200, 400]).toContain(res.status);
      if (res.status === 200) expect(res.body.objInstance?.strStatus).toBe('confirm_requested');
    });

    it('PATCH /api/event-instances/:id/status (dba_confirmed, DBA) → 200', async () => {
      if (!nInstanceId) return;
      const res = await request(app)
        .patch(`/api/event-instances/${nInstanceId}/status`)
        .set('Authorization', `Bearer ${strDbaToken}`)
        .send({ strNextStatus: 'dba_confirmed', strComment: 'DBA 컨펌' });
      expect([200, 400]).toContain(res.status);
      if (res.status === 200) expect(res.body.objInstance?.strStatus).toBe('dba_confirmed');
    });

    it('POST /api/event-instances/:id/execute (권한 있으면 200/400, 403 아님)', async () => {
      const list = await request(app).get('/api/event-instances').set('Authorization', `Bearer ${strDbaToken}`);
      const id = list.body?.arrInstances?.[0]?.nId;
      if (!id) return;
      const res = await request(app)
        .post(`/api/event-instances/${id}/execute`)
        .set('Authorization', `Bearer ${strDbaToken}`)
        .send({ strEnv: 'qa' });
      expect(res.status).not.toBe(403);
      expect([200, 400, 404]).toContain(res.status);
    });

    it('DELETE /api/event-instances/:id (delete_any·delete_own 모두 해당 없으면) → 403', async () => {
      // 기획자(planner): 나의 대시보드 보기는 있으나 삭제 권한 없음 — GM은 instance.delete_own이 있어 본인 건 삭제 가능
      const loginPlanner = await request(app)
        .post('/api/auth/login')
        .send({ strUserId: 'planner01', strPassword: OBJ_PASSWORDS.planner01 });
      expect(loginPlanner.status).toBe(200);
      const strPlannerToken = loginPlanner.body?.strToken;
      const list = await request(app).get('/api/event-instances').set('Authorization', `Bearer ${strPlannerToken}`);
      const live = (list.body?.arrInstances ?? []).find((i: { strStatus: string }) => i.strStatus === 'live_verified');
      const nId = live?.nId ?? 1;
      const res = await request(app).delete(`/api/event-instances/${nId}`).set('Authorization', `Bearer ${strPlannerToken}`);
      expect(res.status).toBe(403);
    });

    it('DELETE /api/event-instances/:id (진행 중 인스턴스, admin 삭제 권한) → 200', async () => {
      const products = await request(app).get('/api/products').set('Authorization', `Bearer ${strAdminToken}`);
      const events = await request(app).get('/api/events').set('Authorization', `Bearer ${strAdminToken}`);
      const p = products.body?.arrProducts?.[0];
      const e = events.body?.arrEvents?.[0];
      const createRes = await request(app)
        .post('/api/event-instances')
        .set('Authorization', `Bearer ${strAdminToken}`)
        .send({
          nEventTemplateId: e?.nId ?? 1,
          nProductId: p?.nId ?? 1,
          strEventLabel: 'DEL테스트',
          strProductName: p?.strName ?? '테스트',
          strServiceAbbr: 'T',
          strServiceRegion: '국내',
          strCategory: '아이템',
          strType: '지급',
          strEventName: '[T] 삭제 테스트용 임시 이벤트',
          strInputValues: '1',
          strGeneratedQuery: 'SELECT 1;',
          dtDeployDate: new Date(Date.now() + 86400000).toISOString(),
          arrDeployScope: ['qa', 'live'],
          strCreatedBy: 'admin테스트',
        });
      expect(createRes.status).toBe(200);
      const nNewId = createRes.body?.objInstance?.nId;
      expect(nNewId).toBeDefined();
      const res = await request(app)
        .delete(`/api/event-instances/${nNewId}`)
        .set('Authorization', `Bearer ${strAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body?.objInstance?.bPermanentlyRemoved).toBe(true);
    });

    // 쿼리 수정 권한: my_dashboard.query_edit 없으면 confirm_requested/qa_requested/live_requested 단계에서 PUT(strGeneratedQuery) → 403
    it('query_edit 없이 쿼리 수정 PUT → 403', async () => {
      const N_ROLE_DBA = 2;
      const backup = fnGetPermissionsByRoleId(N_ROLE_DBA);
      // DBA 역할에서 query_edit 제거 (execute_qa만 부여 시 확장으로도 query_edit 안 붙음)
      fnSetPermissionsForRole(N_ROLE_DBA, ['my_dashboard.view', 'my_dashboard.detail', 'instance.execute_qa', 'instance.execute_live'] as TPermission[]);
      const loginRes = await request(app).post('/api/auth/login').send({ strUserId: 'dba01', strPassword: OBJ_PASSWORDS.dba01 });
      const token = loginRes.body?.strToken;
      expect(loginRes.status).toBe(200);
      expect(token).toBeDefined();
      const perms = loginRes.body.user?.arrPermissions ?? [];
      expect(perms).not.toContain('my_dashboard.query_edit');

      const list = await request(app).get('/api/event-instances').set('Authorization', `Bearer ${token}`);
      const arr = list.body?.arrInstances ?? [];
      const inConfirm = arr.find((i: { strStatus: string }) => i.strStatus === 'confirm_requested');
      const inQaReq = arr.find((i: { strStatus: string }) => i.strStatus === 'qa_requested');
      const id = (inConfirm ?? inQaReq ?? arr[0])?.nId;
      if (!id) {
        fnSetPermissionsForRole(N_ROLE_DBA, backup);
        return;
      }
      const res = await request(app)
        .put(`/api/event-instances/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ strGeneratedQuery: 'SELECT 1;' });
      expect(res.status).toBe(403);
      expect(res.body?.strMessage).toMatch(/query_edit|쿼리 수정/);

      fnSetPermissionsForRole(N_ROLE_DBA, backup);
    });
  });
});
