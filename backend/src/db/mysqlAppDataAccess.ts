import type { Pool, RowDataPacket } from 'mysql2/promise';
import { ARR_MYSQL_APP_DDL, ARR_META_TABLE_NAMES, fnExtractMysqlDdlTableName } from './mysqlAppSchema';
import {
  fnRelationalLoadActivityLogs,
  fnRelationalLoadDbConnections,
  fnRelationalLoadEventInstances,
  fnRelationalLoadEvents,
  fnRelationalLoadProducts,
  fnRelationalLoadRolePermissions,
  fnRelationalLoadRoles,
  fnRelationalLoadUserRoles,
  fnRelationalLoadUserUiRoot,
  fnRelationalLoadUsers,
  fnRelationalReplaceFullFromImportPayload,
  fnRelationalReplaceUserUiOnly,
  fnRelationalWriteFullFromMemory,
  type IRelationalImportPayload,
} from './mysqlRelationalSync';

export type { IRelationalImportPayload, IUserRowJson, IRoleRowJson } from './mysqlRelationalSync';

/** jsonStore STR_FILE 값 → 대표 정규화 테이블(로그·호환용) */
export const fnFilenameToMysqlTable = (strFilename: string): string | null => {
  const map: Record<string, string> = {
    'products.json': 'product',
    'events.json': 'event_template',
    'eventInstances.json': 'event_instance',
    'dbConnections.json': 'db_connection',
    'users.json': 'users',
    'roles.json': 'roles',
    'userRoles.json': 'user_roles',
    'rolePermissions.json': 'role_permissions',
    'activity_logs.json': 'activity_log',
  };
  return map[strFilename] ?? null;
};

export const fnEnsureMysqlAppSchema = async (pool: Pool): Promise<void> => {
  const [arrLegacyRows] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME AS strTableName
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN ('push_subscription', 'notification_subscription')`,
  );
  const setTableNames = new Set(
    (arrLegacyRows as RowDataPacket[]).map((row) => String(row.strTableName)),
  );
  if (setTableNames.has('push_subscription') && !setTableNames.has('notification_subscription')) {
    await pool.query('RENAME TABLE push_subscription TO notification_subscription');
    console.log('[DATA_MYSQL] 테이블 명칭 이관 | push_subscription → notification_subscription');
  }
  const nDdl = ARR_MYSQL_APP_DDL.length;
  console.log(`[DATA_MYSQL] 스키마 DDL 적용 시작 | 문장=${nDdl}건`);
  for (let nIdx = 0; nIdx < nDdl; nIdx++) {
    const strSql = ARR_MYSQL_APP_DDL[nIdx];
    await pool.query(strSql);
    const strTable = fnExtractMysqlDdlTableName(strSql) ?? `ddl_${nIdx + 1}`;
    console.log(`[DATA_MYSQL] 테이블 보장 완료 | ${strTable}`);
  }
  const [dbRows] = await pool.query<RowDataPacket[]>('SELECT DATABASE() AS strDb');
  const strCurrentDb = String((dbRows as RowDataPacket[])[0]?.strDb ?? '').trim();
  if (!strCurrentDb) {
    throw new Error(
      '[DATA_MYSQL] 연결에 기본 스키마가 없습니다. DATA_MYSQL_URL 끝에 /DB명 을 붙이거나 DATA_MYSQL_DATABASE 를 설정하세요.',
    );
  }
  const strPlaceholders = ARR_META_TABLE_NAMES.map(() => '?').join(', ');
  const [cntRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM information_schema.tables
     WHERE table_schema = ? AND table_name IN (${strPlaceholders})`,
    [strCurrentDb, ...ARR_META_TABLE_NAMES],
  );
  const nTables = Number((cntRows as RowDataPacket[])[0]?.n) || 0;
  const nExpected = ARR_META_TABLE_NAMES.length;
  console.log(
    `[DATA_MYSQL] 스키마 점검 완료 | database=${strCurrentDb} | information_schema=${nTables}/${nExpected}`,
  );
  if (nTables < nExpected) {
    console.warn(
      `[DATA_MYSQL] 메타 테이블이 ${nExpected}개 미만입니다. CREATE 권한·스키마를 확인하세요.`,
    );
  }

  const [colRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_instance_status_log' AND COLUMN_NAME = 'json_query_edit'`,
  );
  if (Number((colRows as RowDataPacket[])[0]?.n) === 0) {
    await pool.query(
      `ALTER TABLE event_instance_status_log ADD COLUMN json_query_edit JSON NULL COMMENT 'IStatusLog.objQueryEdit' AFTER json_execution_result`,
    );
    console.log('[DATA_MYSQL] 컬럼 추가 | event_instance_status_log.json_query_edit');
  }

  const [tplCreatorCols] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_template' AND COLUMN_NAME = 'str_created_by'`,
  );
  if (Number((tplCreatorCols as RowDataPacket[])[0]?.n) === 0) {
    await pool.query(
      `ALTER TABLE event_template
       ADD COLUMN str_created_by VARCHAR(200) NULL COMMENT 'JSON strCreatedBy' AFTER str_query_template,
       ADD COLUMN n_created_by_user_id INT NULL COMMENT 'JSON nCreatedByUserId' AFTER str_created_by`,
    );
    await pool.query(
      `ALTER TABLE event_template
       ADD CONSTRAINT fk_event_template_creator
       FOREIGN KEY (n_created_by_user_id) REFERENCES users(n_id) ON DELETE SET NULL`,
    ).catch(() => {
      // FK 중복·users 없음 등 — 컬럼만 있으면 동작
    });
    console.log('[DATA_MYSQL] 컬럼 추가 | event_template.str_created_by, n_created_by_user_id');
  }

  const [tplStatusCol] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_template' AND COLUMN_NAME = 'str_status'`,
  );
  if (Number((tplStatusCol as RowDataPacket[])[0]?.n) === 0) {
    await pool.query(
      `ALTER TABLE event_template
       ADD COLUMN str_status VARCHAR(32) NOT NULL DEFAULT 'dba_confirmed'
         COMMENT 'template_created|confirm_requested|dba_confirmed' AFTER dt_created_at,
       ADD COLUMN json_status_logs JSON NOT NULL COMMENT 'ITemplateStatusLog[]' AFTER str_status,
       ADD COLUMN json_creator JSON NULL COMMENT 'objCreator' AFTER json_status_logs,
       ADD COLUMN json_confirmer JSON NULL COMMENT 'objConfirmer' AFTER json_creator,
       ADD KEY idx_event_template_status (str_status)`,
    );
    await pool.query(
      `UPDATE event_template SET json_status_logs = '[]' WHERE json_status_logs IS NULL`,
    ).catch(() => { /* NOT NULL DEFAULT handled */ });
    console.log('[DATA_MYSQL] 컬럼 추가 | event_template.str_status, json_status_logs, json_creator, json_confirmer');
  }

  const [userEmailCol] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'str_email'`,
  );
  if (Number((userEmailCol as RowDataPacket[])[0]?.n) === 0) {
    await pool.query(
      `ALTER TABLE users
       ADD COLUMN str_email VARCHAR(255) NULL AFTER str_display_name,
       ADD COLUMN str_status VARCHAR(32) NOT NULL DEFAULT 'active' AFTER str_email`,
    );
    console.log('[DATA_MYSQL] 컬럼 추가 | users.str_email, users.str_status');
  }

  const [instRemovedCol] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_instance' AND COLUMN_NAME = 'b_permanently_removed'`,
  );
  if (Number((instRemovedCol as RowDataPacket[])[0]?.n) === 0) {
    await pool.query(
      `ALTER TABLE event_instance
       ADD COLUMN b_permanently_removed TINYINT(1) NOT NULL DEFAULT 0 AFTER dt_created_at,
       ADD COLUMN dt_permanently_removed_at DATETIME(6) NULL AFTER b_permanently_removed`,
    );
    console.log('[DATA_MYSQL] 컬럼 추가 | event_instance.b_permanently_removed, dt_permanently_removed_at');
  }

  const [dbConnSvcCol] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'db_connection' AND COLUMN_NAME = 'str_service_abbr'`,
  );
  if (Number((dbConnSvcCol as RowDataPacket[])[0]?.n) === 0) {
    await pool.query(
      `ALTER TABLE db_connection
       ADD COLUMN str_service_abbr VARCHAR(64) NULL COMMENT 'products.arrServices[].strAbbr, NULL=공통'
       AFTER str_product_name,
       ADD KEY idx_db_connection_product_service_env (n_product_id, str_service_abbr, str_env, b_is_active)`,
    );
    console.log('[DATA_MYSQL] 컬럼 추가 | db_connection.str_service_abbr');
  }

  const [dbConnSvcIdCol] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'db_connection' AND COLUMN_NAME = 'n_service_id'`,
  );
  if (Number((dbConnSvcIdCol as RowDataPacket[])[0]?.n) === 0) {
    await pool.query(
      `ALTER TABLE db_connection
       ADD COLUMN n_service_id BIGINT NULL COMMENT 'product_service.n_id, NULL=공통'
       AFTER str_product_name,
       ADD KEY idx_db_connection_service (n_service_id)`,
    );
    console.log('[DATA_MYSQL] 컬럼 추가 | db_connection.n_service_id');
  }

  const [instSvcIdCol] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_instance' AND COLUMN_NAME = 'n_service_id'`,
  );
  if (Number((instSvcIdCol as RowDataPacket[])[0]?.n) === 0) {
    await pool.query(
      `ALTER TABLE event_instance
       ADD COLUMN n_service_id BIGINT NULL COMMENT 'product_service.n_id'
       AFTER n_product_id,
       ADD KEY idx_event_instance_service (n_service_id)`,
    );
    console.log('[DATA_MYSQL] 컬럼 추가 | event_instance.n_service_id');
  }

  const [etqsLiveCol] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_template_query_set' AND COLUMN_NAME = 'n_live_db_connection_id'`,
  );
  if (Number((etqsLiveCol as RowDataPacket[])[0]?.n) === 0) {
    await pool.query(
      `ALTER TABLE event_template_query_set
       ADD COLUMN n_live_db_connection_id INT NULL
         COMMENT 'IQueryTemplateItem.nLiveDbConnectionId' AFTER n_db_connection_id`,
    );
    console.log('[DATA_MYSQL] 컬럼 추가 | event_template_query_set.n_live_db_connection_id');
  }

  const [eietLiveCol] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_instance_execution_target' AND COLUMN_NAME = 'n_live_db_connection_id'`,
  );
  if (Number((eietLiveCol as RowDataPacket[])[0]?.n) === 0) {
    await pool.query(
      `ALTER TABLE event_instance_execution_target
       ADD COLUMN n_live_db_connection_id INT NULL
         COMMENT 'nLiveDbConnectionId' AFTER n_db_connection_id`,
    );
    console.log('[DATA_MYSQL] 컬럼 추가 | event_instance_execution_target.n_live_db_connection_id');
  }

  // 세트별 입력 ID·형식
  const [etqsInputIdCol] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_template_query_set' AND COLUMN_NAME = 'str_input_id'`,
  );
  if (Number((etqsInputIdCol as RowDataPacket[])[0]?.n) === 0) {
    await pool.query(
      `ALTER TABLE event_template_query_set
       ADD COLUMN str_input_id VARCHAR(64) NOT NULL DEFAULT 'items'
         COMMENT 'IQueryTemplateItem.strInputId' AFTER n_live_db_connection_id`,
    );
    console.log('[DATA_MYSQL] 컬럼 추가 | event_template_query_set.str_input_id');
  }
  const [etqsInputFmtCol] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_template_query_set' AND COLUMN_NAME = 'str_input_format'`,
  );
  if (Number((etqsInputFmtCol as RowDataPacket[])[0]?.n) === 0) {
    await pool.query(
      `ALTER TABLE event_template_query_set
       ADD COLUMN str_input_format VARCHAR(64) NOT NULL DEFAULT 'item_number'
         COMMENT 'IQueryTemplateItem.strInputFormat' AFTER str_input_id`,
    );
    // 레거시: 템플릿 format → 세트 format 백필
    await pool.query(
      `UPDATE event_template_query_set qs
       INNER JOIN event_template t ON t.n_id = qs.n_event_template_id
       SET qs.str_input_format = COALESCE(NULLIF(TRIM(t.str_input_format), ''), 'item_number')
       WHERE qs.str_input_format = 'item_number' OR qs.str_input_format IS NULL OR qs.str_input_format = ''`,
    );
    console.log('[DATA_MYSQL] 컬럼 추가 | event_template_query_set.str_input_format (+ 템플릿 format 백필)');
  }
};

export const fnMysqlCountProducts = async (pool: Pool): Promise<number> => {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM product');
  return Number(rows[0]?.n) || 0;
};

/** 인메모리 스냅샷 전체를 DB에 반영(FK 순서 내장). strFilename·arr 인자는 호환만 유지. */
export const fnMysqlReplaceByFilename = async (
  pool: Pool,
  _strFilename: string,
  _arr: unknown[],
): Promise<void> => {
  await fnRelationalWriteFullFromMemory(pool);
};

const mapLoader: Record<string, (pool: Pool) => Promise<unknown[]>> = {
  'products.json': fnRelationalLoadProducts,
  'dbConnections.json': fnRelationalLoadDbConnections,
  'events.json': fnRelationalLoadEvents,
  'eventInstances.json': fnRelationalLoadEventInstances,
  'users.json': fnRelationalLoadUsers,
  'roles.json': fnRelationalLoadRoles,
  'userRoles.json': fnRelationalLoadUserRoles,
  'rolePermissions.json': fnRelationalLoadRolePermissions,
  'activity_logs.json': fnRelationalLoadActivityLogs,
};

export const fnMysqlLoadArrayByFilename = async (pool: Pool, strFilename: string): Promise<unknown[]> => {
  const fn = mapLoader[strFilename];
  if (!fn) return [];
  return fn(pool);
};

export const fnMysqlReplaceUserUiRoot = async (
  pool: Pool,
  objRoot: { mapByUserId: Record<string, Record<string, string>> },
): Promise<void> => {
  await fnRelationalReplaceUserUiOnly(pool, objRoot);
};

export const fnMysqlLoadUserUiRoot = async (
  pool: Pool,
): Promise<{ mapByUserId: Record<string, Record<string, string>> }> => {
  return fnRelationalLoadUserUiRoot(pool);
};

/** 부트스트랩·CLI: 디스크에서 읽은 배열을 한 트랜잭션으로 적재 */
export const fnMysqlImportRelationalPayload = async (
  pool: Pool,
  payload: IRelationalImportPayload,
): Promise<void> => {
  await fnRelationalReplaceFullFromImportPayload(pool, payload);
};
