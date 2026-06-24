/**
 * backend/data/rolePermissions.json + 역할 정의 → scripts/live_meta_roles_permissions.sql
 * 실행: cd backend && npx tsx src/scripts/generateLiveMetaRolesPermissionsSql.ts
 */
import fs from 'fs';
import path from 'path';

interface IRolePermissionRow {
  nRoleId: number;
  strPermission: string;
}

/** QA rolePermissions.json 과 동기 — 커스텀 역할(5·7) 포함 */
const ARR_ROLES: Array<{
  nId: number;
  strCode: string;
  strDisplayName: string;
  strDescription: string;
  bIsSystem: boolean;
}> = [
  { nId: 1, strCode: 'admin', strDisplayName: '관리자', strDescription: '전체 시스템 관리 권한', bIsSystem: true },
  { nId: 2, strCode: 'dba', strDisplayName: 'DBA', strDescription: 'DB 쿼리 실행 전담', bIsSystem: true },
  { nId: 3, strCode: 'game_manager', strDisplayName: 'GM', strDescription: '게임 운영 관리자', bIsSystem: true },
  { nId: 4, strCode: 'game_designer', strDisplayName: '기획자', strDescription: '이벤트 기획 및 생성', bIsSystem: true },
  { nId: 5, strCode: 'operator', strDisplayName: '운영', strDescription: 'QA 커스텀 역할(n_id=5) — QA roles와 다르면 export 스크립트로 덮어쓸 것', bIsSystem: false },
  { nId: 6, strCode: 'guest', strDisplayName: '승인 대기(GUEST)', strDescription: '가입 시 부여(로그인은 승인 후)', bIsSystem: true },
  { nId: 7, strCode: 'viewer', strDisplayName: '열람', strDescription: 'QA 커스텀 역할(n_id=7) — QA roles와 다르면 export 스크립트로 덮어쓸 것', bIsSystem: false },
];

const STR_DT = '2026-05-22 18:16:54.944000';
const STR_RP_PATH = path.join(__dirname, '../../data/rolePermissions.json');
const STR_OUT = path.join(__dirname, '../../../scripts/live_meta_roles_permissions.sql');

const fnEsc = (s: string): string => s.replace(/'/g, "''");

const fnMain = (): void => {
  if (!fs.existsSync(STR_RP_PATH)) {
    console.error(`[generate] 없음: ${STR_RP_PATH}`);
    process.exit(1);
  }
  const arrRp = JSON.parse(fs.readFileSync(STR_RP_PATH, 'utf-8')) as IRolePermissionRow[];

  const arrRoleLines = ARR_ROLES.map(
    (r) =>
      `\t(${r.nId}, '${fnEsc(r.strCode)}', '${fnEsc(r.strDisplayName)}', '${fnEsc(r.strDescription)}', ${r.bIsSystem ? 1 : 0}, '${STR_DT}', '${STR_DT}')`,
  );
  const arrPermLines = arrRp.map(
    (r) => `\t(${r.nRoleId}, '${fnEsc(r.strPermission)}')`,
  );

  const strSql = `-- LIVE 메타 초기화 — 역할·권한 (QA rolePermissions.json 기준)
-- 생성: npx tsx backend/src/scripts/generateLiveMetaRolesPermissionsSql.ts
-- QA roles.str_code·str_display_name 이 다르면 scripts/export_qa_meta_for_live.sh 로 roles 덮어쓸 것

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM role_permissions;
DELETE FROM roles;

INSERT INTO roles (n_id, str_code, str_display_name, str_description, b_is_system, dt_created_at, dt_updated_at) VALUES
${arrRoleLines.join(',\n')};

INSERT INTO role_permissions (n_role_id, str_permission) VALUES
${arrPermLines.join(',\n')};

SET FOREIGN_KEY_CHECKS = 1;
`;

  fs.writeFileSync(STR_OUT, strSql, 'utf-8');
  console.log(`[generate] ${STR_OUT} | roles=${ARR_ROLES.length} permissions=${arrRp.length}`);
};

fnMain();
