/**
 * 역할 저장 권한(①) vs 로그인 확장 권한(②③) vs 메뉴 노출 — admin·커스텀 역할 검증
 */
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app';
import { fnBuildAuthUserPayload } from '../services/authUserResponse';
import { fnGetPermissionsByRoleId, fnSetPermissionsForRole, fnSaveRolePermissions } from '../data/rolePermissions';
import { arrRoles, fnFindRoleByCode, fnGetNextRoleId, fnSaveRoles } from '../data/roles';
import { arrUsers, fnSaveUsers } from '../data/users';
import { fnSetRolesForUser, fnSaveUserRoles } from '../data/userRoles';
import type { TPermission } from '../types';

/** MainLayout.tsx 메뉴 노출 규칙과 동일 */
const fnResolveVisibleMenus = (arrPermissions: string[]): string[] => {
  const fnHas = (p: string) => arrPermissions.includes(p);
  const arrMenus: string[] = [];
  if (fnHas('dashboard.view')) arrMenus.push('대시보드');
  if (fnHas('product.view')) arrMenus.push('프로덕트');
  if (fnHas('db_connection.view') || fnHas('db.manage')) arrMenus.push('DB 접속 정보');
  if (fnHas('event_template.view')) arrMenus.push('쿼리 템플릿');
  if (fnHas('user.view')) arrMenus.push('사용자');
  if (fnHas('role.view')) arrMenus.push('역할 권한');
  if (fnHas('activity.view')) arrMenus.push('활동');
  if (fnHas('my_dashboard.view')) arrMenus.push('나의 대시보드');
  if (fnHas('instance.view') || fnHas('instance.create')) arrMenus.push('이벤트 생성');
  return arrMenus;
};

/** RolePage 체크박스에 표시되는 세분화 권한만 (ARR_PERMISSION_GROUPS flat) */
const ARR_UI_GRANULAR: string[] = [
  'dashboard.view',
  'product.view', 'product.create', 'product.edit', 'product.delete',
  'event_template.view', 'event_template.create', 'event_template.edit', 'event_template.delete',
  'event_template.request_confirm', 'event_template.confirm',
  'db_connection.view', 'db_connection.create', 'db_connection.edit', 'db_connection.delete', 'db_connection.test',
  'user.view', 'user.create', 'user.edit', 'user.delete', 'user.reset_password', 'user.approve',
  'role.view', 'role.create', 'role.edit', 'role.delete', 'role.edit_permissions',
  'activity.view', 'activity.clear',
  'my_dashboard.view', 'my_dashboard.detail', 'my_dashboard.edit', 'my_dashboard.edit_any',
  'my_dashboard.request_confirm', 'my_dashboard.query_edit', 'my_dashboard.confirm',
  'my_dashboard.request_qa', 'my_dashboard.execute_qa', 'my_dashboard.verify_qa', 'my_dashboard.request_qa_rereq',
  'my_dashboard.request_live', 'my_dashboard.execute_live', 'my_dashboard.verify_live', 'my_dashboard.request_live_rereq',
  'my_dashboard.hide', 'my_dashboard.delete_any',
  'instance.view', 'instance.create', 'instance.delete_own',
  'system.save_test_seed',
];

const fnCountRoleFormChecked = (arrStored: string[]): number =>
  arrStored.filter((p) => ARR_UI_GRANULAR.includes(p)).length;

describe('역할 권한 ↔ 메뉴 노출 매트릭스', () => {
  let strAdminToken: string;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({ strUserId: 'admin', strPassword: 'admin123' });
    strAdminToken = res.body.strToken;
  });

  it('admin: 저장 24개·체크박스 미체크 vs 로그인 확장·메뉴', async () => {
    const objAdminRole = fnFindRoleByCode('admin');
    expect(objAdminRole).toBeDefined();
    const arrStored = fnGetPermissionsByRoleId(objAdminRole!.nId);
    const objLogin = await request(app).post('/api/auth/login').send({ strUserId: 'admin', strPassword: 'admin123' });
    const arrEffective = objLogin.body.user?.arrPermissions as string[];

    const nFormChecked = fnCountRoleFormChecked(arrStored);
    const arrMenus = fnResolveVisibleMenus(arrEffective);

    console.log('[admin] 저장 권한 수:', arrStored.length);
    console.log('[admin] 역할 폼 체크박스 매칭 수:', nFormChecked);
    console.log('[admin] 로그인 effective 수:', arrEffective.length);
    console.log('[admin] dashboard.view 저장:', arrStored.includes('dashboard.view'), '| effective:', arrEffective.includes('dashboard.view'));
    console.log('[admin] product.view 저장:', arrStored.includes('product.view'), '| effective:', arrEffective.includes('product.view'));
    console.log('[admin] 노출 메뉴:', arrMenus.join(', '));

    // admin 보너스: dashboard.view는 저장 없어도 effective에 있을 수 있음
    expect(arrEffective).toContain('dashboard.view');
    expect(arrMenus).toContain('대시보드');
    expect(arrMenus).toContain('프로덕트');
    // 역할 폼과 effective 불일치가 재현되는지
    if (!arrStored.includes('dashboard.view')) {
      expect(nFormChecked).toBeLessThan(arrStored.length);
    }
  });

  describe('커스텀 역할 — 권한 1개씩 메뉴 노출', () => {
    const ARR_MENU_PROBE: Array<{ strPerm: TPermission; strMenu: string; arrAlso?: TPermission[] }> = [
      { strPerm: 'dashboard.view', strMenu: '대시보드' },
      { strPerm: 'product.view', strMenu: '프로덕트' },
      { strPerm: 'event_template.view', strMenu: '쿼리 템플릿' },
      { strPerm: 'db_connection.view', strMenu: 'DB 접속 정보' },
      { strPerm: 'user.view', strMenu: '사용자' },
      { strPerm: 'role.view', strMenu: '역할 권한' },
      { strPerm: 'activity.view', strMenu: '활동' },
      { strPerm: 'my_dashboard.view', strMenu: '나의 대시보드' },
      { strPerm: 'instance.create', strMenu: '이벤트 생성', arrAlso: ['instance.view'] },
      { strPerm: 'db.manage', strMenu: 'DB 접속 정보', arrAlso: ['db_connection.view'] },
    ];

    const strRoleCode = 'perm_probe_menu';
    let nRoleId = 0;
    let nUserId = 0;
    const strUserId = 'perm_probe_user';

    beforeAll(async () => {
      const existing = fnFindRoleByCode(strRoleCode);
      if (existing) {
        nRoleId = existing.nId;
      } else {
        nRoleId = fnGetNextRoleId();
        arrRoles.push({
          nId: nRoleId,
          strCode: strRoleCode,
          strDisplayName: '권한 프로브',
          strDescription: '메뉴 매트릭스 테스트용',
          bIsSystem: false,
          dtCreatedAt: new Date().toISOString(),
          dtUpdatedAt: new Date().toISOString(),
        });
        fnSaveRoles();
      }

      let objUser = arrUsers.find((u) => u.strUserId === strUserId);
      if (!objUser) {
        nUserId = (arrUsers.length > 0 ? Math.max(...arrUsers.map((u) => u.nId)) : 0) + 1;
        objUser = {
          nId: nUserId,
          strUserId,
          strPassword: await bcrypt.hash('probe123', 10),
          strDisplayName: '권한프로브',
          dtCreatedAt: new Date().toISOString(),
        };
        arrUsers.push(objUser);
        fnSaveUsers();
      } else {
        nUserId = objUser.nId;
        objUser.strPassword = await bcrypt.hash('probe123', 10);
        fnSaveUsers();
      }
      fnSetRolesForUser(nUserId, [nRoleId]);
      fnSaveUserRoles();
    });

    it.each(ARR_MENU_PROBE)('$strPerm 단독 → $strMenu 메뉴', async ({ strPerm, strMenu, arrAlso }) => {
      fnSetPermissionsForRole(nRoleId, [strPerm]);
      fnSaveRolePermissions();

      const objUser = arrUsers.find((u) => u.nId === nUserId)!;
      const objPayload = fnBuildAuthUserPayload({
        nId: objUser.nId,
        strUserId: objUser.strUserId,
        strPassword: objUser.strPassword,
        strDisplayName: objUser.strDisplayName,
        arrRoles: [strRoleCode],
        dtCreatedAt: new Date(objUser.dtCreatedAt),
      });
      const arrMenus = fnResolveVisibleMenus(objPayload.arrPermissions);

      expect(arrMenus).toContain(strMenu);
      if (arrAlso) {
        arrAlso.forEach((p) => expect(objPayload.arrPermissions).toContain(p));
      }
      // admin 보너스 없음 — dashboard.view 단독 외 메뉴 없어야 함(해당 perm만)
      if (strPerm === 'dashboard.view') {
        expect(arrMenus).toEqual(['대시보드']);
      }
    });

    it('product.view 단독 — 역할 폼 1개 체크·대시보드 메뉴 없음', async () => {
      fnSetPermissionsForRole(nRoleId, ['product.view']);
      fnSaveRolePermissions();

      const arrStored = fnGetPermissionsByRoleId(nRoleId);
      expect(fnCountRoleFormChecked(arrStored)).toBe(1);

      const login = await request(app).post('/api/auth/login').send({ strUserId, strPassword: 'probe123' });
      expect(login.status).toBe(200);
      const arrMenus = fnResolveVisibleMenus(login.body.user?.arrPermissions ?? []);
      expect(arrMenus).toEqual(['프로덕트']);
      expect(arrMenus).not.toContain('대시보드');
    });

    afterAll(async () => {
      // admin 테스트 영향 없도록 프로브 역할 비우기
      fnSetPermissionsForRole(nRoleId, ['my_dashboard.view']);
      fnSaveRolePermissions();
    });
  });

  it('GET /api/roles admin — 저장 권한과 로그인 effective 차이 로그', async () => {
    const res = await request(app).get('/api/roles').set('Authorization', `Bearer ${strAdminToken}`);
    expect(res.status).toBe(200);
    const objAdmin = (res.body.arrRoles as Array<{ strCode: string; arrPermissions: string[] }>)
      .find((r) => r.strCode === 'admin');
    expect(objAdmin).toBeDefined();
    const login = await request(app).post('/api/auth/login').send({ strUserId: 'admin', strPassword: 'admin123' });
    const arrEff = login.body.user?.arrPermissions as string[];
    const arrOnlyEffective = arrEff.filter((p) => !objAdmin!.arrPermissions.includes(p));
    console.log('[admin] API 저장-only vs effective-only:', {
      nStored: objAdmin!.arrPermissions.length,
      nEffective: arrEff.length,
      arrEffectiveOnlySample: arrOnlyEffective.slice(0, 15),
    });
    expect(arrOnlyEffective.length).toBeGreaterThan(0);
  });
});
