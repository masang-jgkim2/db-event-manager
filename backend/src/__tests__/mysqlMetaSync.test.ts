/**
 * 메타 MySQL 정규화 동기화 통합 테스트 (선택 실행)
 *
 * ⚠ 전용 DB만 사용: 성공 시 `fnRelationalReplaceFullFromImportPayload`가 메타 테이블을 **전부 비운 뒤**
 * 아래 최소 데이터만 넣습니다. 운영/공유 스키마에서 실행하지 마세요.
 *
 * 실행 (backend 디렉터리):
 *   PowerShell: `$env:RUN_MYSQL_META_TESTS='1'; npm run test:mysql-meta`
 *   cmd:        `set RUN_MYSQL_META_TESTS=1&& npm run test:mysql-meta`
 *
 * 필요: `backend/.env`에 `DATA_MYSQL_URL` 또는 `DATA_MYSQL_*` + `DATA_MYSQL_DATABASE` (스키마명).
 *
 * 수동으로 한두 번 더 확인하면 좋은 항목 (이 파일에 자동화 안 함):
 * - 서버 기동 `DATA_STORE=mysql` + 로그인·상품 CRUD 후 DB 반영
 * - `npm run import-json-to-mysql` 전체 JSON 적재
 * - `userUiPreferences` PUT 후 `user_ui_preference` 행
 * - 활동 로그 옵트인 후 `activity_log` + 스냅샷 플러시
 */
import '../loadEnv';
import type { RowDataPacket } from 'mysql2/promise';
import type { IDbConnection } from '../types';
import type { IProduct } from '../data/products';
import type { IEventTemplate } from '../data/events';
import type { IEventInstance } from '../data/eventInstances';
import type { IActivityLogRow } from '../data/activityLogs';
import {
  type IRelationalImportPayload,
  type IUserRowJson,
  type IRoleRowJson,
} from '../db/mysqlRelationalSync';
import { fnEnsureMysqlAppSchema, fnMysqlImportRelationalPayload } from '../db/mysqlAppDataAccess';
import {
  fnRelationalLoadActivityLogs,
  fnRelationalLoadProducts,
  fnRelationalLoadUsers,
  fnRelationalLoadUserUiRoot,
  fnRelationalReplaceUserUiOnly,
} from '../db/mysqlRelationalSync';
import { fnGetMysqlAppPool, fnResetMysqlAppPoolForTests } from '../db/mysqlAppPool';
import { ARR_META_TABLE_NAMES } from '../db/mysqlAppSchema';

const B_RUN =
  process.env.RUN_MYSQL_META_TESTS === '1' || String(process.env.RUN_MYSQL_META_TESTS).toLowerCase() === 'true';

const fnHasMysqlConfig = (): boolean =>
  Boolean(process.env.DATA_MYSQL_URL?.trim() || process.env.DATA_MYSQL_DATABASE?.trim());

const describeMysql = B_RUN && fnHasMysqlConfig() ? describe : describe.skip;

const N_PRODUCT = 990_001;
const N_DB_CONN = 990_002;
const N_TEMPLATE = 990_003;
const N_INSTANCE = 990_004;
const N_USER = 990_005;
const N_ROLE = 990_006;
const strDt = new Date().toISOString();

const fnBuildMinimalPayload = (): IRelationalImportPayload => {
  const arrProducts: IProduct[] = [
    {
      nId: N_PRODUCT,
      strName: 'jest-mysql-meta-product',
      strDescription: '',
      strDbType: 'mysql',
      arrServices: [{ strAbbr: 'J', strRegion: 'test' }],
      dtCreatedAt: strDt,
    },
  ];
  const arrDbConnections: IDbConnection[] = [
    {
      nId: N_DB_CONN,
      nProductId: N_PRODUCT,
      strProductName: 'jest-mysql-meta-product',
      strKind: 'GAME',
      strEnv: 'dev',
      strDbType: 'mysql',
      strHost: '127.0.0.1',
      nPort: 3306,
      strDatabase: 'test',
      strUser: 'u',
      strPassword: 'p',
      bIsActive: true,
      dtCreatedAt: strDt,
      dtUpdatedAt: strDt,
    },
  ];
  const arrEvents: IEventTemplate[] = [
    {
      nId: N_TEMPLATE,
      nProductId: N_PRODUCT,
      strProductName: 'jest-mysql-meta-product',
      strEventLabel: 'jest-template',
      strDescription: '',
      strCategory: 'cat',
      strType: 'type',
      strInputFormat: 'raw',
      strDefaultItems: '',
      strQueryTemplate: '',
      arrQueryTemplates: [
        { nDbConnectionId: N_DB_CONN, strDefaultItems: '', strQueryTemplate: 'SELECT 1' },
      ],
      dtCreatedAt: strDt,
    },
  ];
  const arrEventInstances: IEventInstance[] = [
    {
      nId: N_INSTANCE,
      nEventTemplateId: N_TEMPLATE,
      nProductId: N_PRODUCT,
      strEventLabel: 'jest-template',
      strProductName: 'jest-mysql-meta-product',
      strServiceAbbr: 'J',
      strServiceRegion: 'test',
      strCategory: 'cat',
      strType: 'type',
      strEventName: 'jest-instance',
      strInputValues: '',
      strGeneratedQuery: '',
      dtDeployDate: strDt,
      arrDeployScope: ['qa'],
      strStatus: 'event_created',
      arrStatusLogs: [],
      objCreator: null,
      objConfirmer: null,
      objQaRequester: null,
      objQaDeployer: null,
      objQaVerifier: null,
      objLiveRequester: null,
      objLiveDeployer: null,
      objLiveVerifier: null,
      strCreatedBy: 'jest',
      nCreatedByUserId: N_USER,
      dtCreatedAt: strDt,
    },
  ];
  const arrUsers: IUserRowJson[] = [
    {
      nId: N_USER,
      strUserId: 'jest_mysql_meta_user',
      strPassword: '$2a$10$jest_mysql_meta_placeholder_hash',
      strDisplayName: 'jest meta',
      dtCreatedAt: strDt,
    },
  ];
  const arrRoles: IRoleRowJson[] = [
    {
      nId: N_ROLE,
      strCode: 'jest_mysql_meta_role',
      strDisplayName: 'jest',
      strDescription: '',
      bIsSystem: false,
      dtCreatedAt: strDt,
      dtUpdatedAt: strDt,
    },
  ];
  const arrActivityLogs: IActivityLogRow[] = [
    {
      nId: 990_007,
      dtAt: strDt,
      strMethod: 'GET',
      strPath: '/api/jest-mysql-meta',
      nStatusCode: 200,
      nActorUserId: N_USER,
      strActorUserId: 'jest_mysql_meta_user',
      arrActorRoles: ['jest_mysql_meta_role'],
      strCategory: 'other',
    },
  ];
  return {
    arrProducts,
    arrDbConnections,
    arrEvents,
    arrEventInstances,
    arrUsers,
    arrRoles,
    arrUserRoles: [{ nUserId: N_USER, nRoleId: N_ROLE }],
    arrRolePermissions: [{ nRoleId: N_ROLE, strPermission: 'product.view' }],
    arrActivityLogs,
    objUserUi: { mapByUserId: {} },
  };
};

describeMysql('메타 MySQL 동기화 (RUN_MYSQL_META_TESTS=1 + DATA_MYSQL_*)', () => {
  let pool: ReturnType<typeof fnGetMysqlAppPool>;

  beforeAll(() => {
    if (!B_RUN || !fnHasMysqlConfig()) return;
    pool = fnGetMysqlAppPool();
  });

  afterAll(() => {
    fnResetMysqlAppPoolForTests();
  });

  it('스키마 적용 후 메타 테이블 존재 개수', async () => {
    await fnEnsureMysqlAppSchema(pool);
    const [dbRows] = await pool.query<RowDataPacket[]>('SELECT DATABASE() AS strDb');
    const strDb = String((dbRows as RowDataPacket[])[0]?.strDb ?? '').trim();
    expect(strDb.length).toBeGreaterThan(0);
    const ph = ARR_META_TABLE_NAMES.map(() => '?').join(', ');
    const [cntRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ? AND table_name IN (${ph})`,
      [strDb, ...ARR_META_TABLE_NAMES],
    );
    const n = Number((cntRows as RowDataPacket[])[0]?.n) || 0;
    expect(n).toBe(ARR_META_TABLE_NAMES.length);
  });

  it('최소 페이로드 적재 → product·users·instance·activity 로드', async () => {
    const payload = fnBuildMinimalPayload();
    await fnMysqlImportRelationalPayload(pool, payload);
    const arrP = await fnRelationalLoadProducts(pool);
    expect(arrP.some((p) => p.nId === N_PRODUCT)).toBe(true);
    const arrU = await fnRelationalLoadUsers(pool);
    expect(arrU.some((u) => u.nId === N_USER)).toBe(true);
    const arrL = await fnRelationalLoadActivityLogs(pool);
    expect(arrL.some((r) => r.nId === 990_007)).toBe(true);
    const [irows] = await pool.query<RowDataPacket[]>(
      'SELECT n_id FROM event_instance WHERE n_id = ?',
      [N_INSTANCE],
    );
    expect((irows as RowDataPacket[]).length).toBe(1);
  });

  it('동일 페이로드 재적재(전체 치환) 후에도 건수 유지', async () => {
    await fnMysqlImportRelationalPayload(pool, fnBuildMinimalPayload());
    await fnMysqlImportRelationalPayload(pool, fnBuildMinimalPayload());
    const arrP = await fnRelationalLoadProducts(pool);
    expect(arrP.filter((p) => p.nId === N_PRODUCT).length).toBe(1);
  });

  it('user_ui_preference 단독 치환·로드', async () => {
    await fnRelationalReplaceUserUiOnly(pool, {
      mapByUserId: { [String(N_USER)]: { theme: 'dark', tableWidthPrefs: '{}' } },
    });
    const root = await fnRelationalLoadUserUiRoot(pool);
    expect(root.mapByUserId[String(N_USER)]?.theme).toBe('dark');
  });
});

if (!B_RUN) {
  // eslint-disable-next-line no-console
  console.log('[mysqlMetaSync.test] 건너뜀 — RUN_MYSQL_META_TESTS=1 및 DATA_MYSQL_* 설정 시 실행');
} else if (!fnHasMysqlConfig()) {
  // eslint-disable-next-line no-console
  console.warn('[mysqlMetaSync.test] RUN_MYSQL_META_TESTS=1 이지만 DATA_MYSQL_* 없음 — 스킵');
}
