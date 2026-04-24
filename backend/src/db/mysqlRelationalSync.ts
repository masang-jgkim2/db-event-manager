/**
 * 정규화 메타 테이블(product, users, …) ↔ 인메모리(JSON 동등 구조) 전체 스냅샷 동기화.
 * FK 때문에 파일 단위 DELETE/INSERT 대신 트랜잭션 내 전체 치환.
 */
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { IDbConnection } from '../types';
import type { IProduct } from '../data/products';
import type { IEventTemplate, IQueryTemplateItem } from '../data/events';
import type {
  IEventInstance,
  IExecutionTarget,
  IStageActor,
  IStatusLog,
  TEventStatus,
} from '../data/eventInstances';
import type { IActivityLogRow } from '../data/activityLogs';
import { fnEncryptDbConnPasswordForDisk } from '../services/dbConnectionPasswordCrypto';

/** users.json 행 */
export interface IUserRowJson {
  nId: number;
  strUserId: string;
  strPassword: string;
  strDisplayName: string;
  dtCreatedAt: string;
}

/** roles.json 행 */
export interface IRoleRowJson {
  nId: number;
  strCode: string;
  strDisplayName: string;
  strDescription: string;
  bIsSystem: boolean;
  dtCreatedAt: string;
  dtUpdatedAt: string;
}

export interface IRelationalImportPayload {
  arrProducts: IProduct[];
  arrDbConnections: IDbConnection[];
  arrEvents: IEventTemplate[];
  arrEventInstances: IEventInstance[];
  arrUsers: IUserRowJson[];
  arrRoles: IRoleRowJson[];
  arrUserRoles: Array<{ nUserId: number; nRoleId: number }>;
  arrRolePermissions: Array<{ nRoleId: number; strPermission: string }>;
  arrActivityLogs: IActivityLogRow[];
  objUserUi: { mapByUserId: Record<string, Record<string, string>> };
}

const ARR_TABLES_DELETE_ORDER = [
  'event_instance_stage_actor',
  'event_instance_status_log',
  'event_instance_execution_target',
  'event_instance_deploy_scope',
  'event_instance',
  'event_template_query_set',
  'event_template',
  'db_connection',
  'activity_log',
  'user_ui_preference',
  'user_roles',
  'role_permissions',
  'roles',
  'users',
  'product_service',
  'product',
] as const;

const fnToMysqlDatetime6 = (v: string | Date | null | undefined): string | null => {
  if (v == null || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n: number, L: number) => String(n).padStart(L, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1, 2)}-${p(d.getDate(), 2)} ${p(d.getHours(), 2)}:${p(d.getMinutes(), 2)}:${p(d.getSeconds(), 2)}.${p(d.getMilliseconds(), 3)}000`;
};

const fnToMysqlDatetime6Required = (v: string | Date | null | undefined, strFallback: string): string => {
  return fnToMysqlDatetime6(v) ?? fnToMysqlDatetime6(strFallback) ?? '1970-01-01 00:00:00.000000';
};

const fnTiny = (b: boolean | undefined): number => (b ? 1 : 0);

const fnResolveDbConnId = (
  nProductId: number,
  nPreferred: number,
  arrDb: IDbConnection[],
): number => {
  if (nPreferred > 0 && arrDb.some((c) => c.nId === nPreferred && c.nProductId === nProductId)) {
    return nPreferred;
  }
  const c =
    arrDb.find((x) => x.nProductId === nProductId && x.bIsActive) ??
    arrDb.find((x) => x.nProductId === nProductId);
  return c?.nId ?? nPreferred;
};

const fnClearAllRelational = async (conn: PoolConnection): Promise<void> => {
  await conn.query('SET FOREIGN_KEY_CHECKS=0');
  for (const strTable of ARR_TABLES_DELETE_ORDER) {
    await conn.query(`DELETE FROM \`${strTable}\``);
  }
  await conn.query('SET FOREIGN_KEY_CHECKS=1');
};

const fnInsertPayload = async (conn: PoolConnection, p: IRelationalImportPayload): Promise<void> => {
  const { arrProducts, arrDbConnections, arrEvents, arrEventInstances } = p;

  for (const prod of arrProducts) {
    const strDt = fnToMysqlDatetime6Required(prod.dtCreatedAt, new Date().toISOString());
    await conn.execute(
      `INSERT INTO product (n_id, str_name, str_description, str_db_type, dt_created_at, dt_updated_at)
       VALUES (?,?,?,?,?,?)`,
      [
        prod.nId,
        prod.strName,
        prod.strDescription ?? '',
        prod.strDbType,
        strDt,
        strDt,
      ],
    );
    let nSort = 0;
    for (const svc of prod.arrServices ?? []) {
      await conn.execute(
        `INSERT INTO product_service (n_product_id, n_sort, str_abbr, str_region) VALUES (?,?,?,?)`,
        [prod.nId, nSort, svc.strAbbr, svc.strRegion],
      );
      nSort += 1;
    }
  }

  for (const u of p.arrUsers) {
    const strDt = fnToMysqlDatetime6Required(u.dtCreatedAt, new Date().toISOString());
    await conn.execute(
      `INSERT INTO users (n_id, str_user_id, str_password, str_display_name, dt_created_at) VALUES (?,?,?,?,?)`,
      [u.nId, u.strUserId, u.strPassword, u.strDisplayName, strDt],
    );
  }

  for (const r of p.arrRoles) {
    await conn.execute(
      `INSERT INTO roles (n_id, str_code, str_display_name, str_description, b_is_system, dt_created_at, dt_updated_at)
       VALUES (?,?,?,?,?,?,?)`,
      [
        r.nId,
        r.strCode,
        r.strDisplayName,
        r.strDescription ?? '',
        fnTiny(r.bIsSystem),
        fnToMysqlDatetime6Required(r.dtCreatedAt, new Date().toISOString()),
        fnToMysqlDatetime6Required(r.dtUpdatedAt, r.dtCreatedAt),
      ],
    );
  }

  for (const ur of p.arrUserRoles) {
    await conn.execute(`INSERT INTO user_roles (n_user_id, n_role_id) VALUES (?,?)`, [
      ur.nUserId,
      ur.nRoleId,
    ]);
  }

  for (const rp of p.arrRolePermissions) {
    const strP = String(rp.strPermission).slice(0, 191);
    await conn.execute(
      `INSERT INTO role_permissions (n_role_id, str_permission) VALUES (?,?)`,
      [rp.nRoleId, strP],
    );
  }

  for (const c of arrDbConnections) {
    await conn.execute(
      `INSERT INTO db_connection (
        n_id, n_product_id, str_product_name, str_kind, str_env, str_db_type, str_host, n_port,
        str_database, str_user, str_password, b_is_active, dt_created_at, dt_updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        c.nId,
        c.nProductId,
        c.strProductName,
        c.strKind,
        c.strEnv,
        c.strDbType,
        c.strHost,
        c.nPort,
        c.strDatabase,
        c.strUser,
        fnEncryptDbConnPasswordForDisk(c.strPassword),
        fnTiny(c.bIsActive),
        fnToMysqlDatetime6Required(c.dtCreatedAt, new Date().toISOString()),
        fnToMysqlDatetime6Required(c.dtUpdatedAt, c.dtCreatedAt),
      ],
    );
  }

  for (const e of arrEvents) {
    await conn.execute(
      `INSERT INTO event_template (
        n_id, n_product_id, str_product_name, str_event_label, str_description, str_category, str_type,
        str_input_format, str_default_items, str_query_template, dt_created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        e.nId,
        e.nProductId,
        e.strProductName,
        e.strEventLabel,
        e.strDescription ?? null,
        e.strCategory,
        e.strType,
        e.strInputFormat,
        e.strDefaultItems || null,
        e.strQueryTemplate?.trim() ? e.strQueryTemplate : null,
        fnToMysqlDatetime6Required(e.dtCreatedAt, new Date().toISOString()),
      ],
    );
    const arrSets = e.arrQueryTemplates?.length ? e.arrQueryTemplates : [];
    if (arrSets.length) {
      let nSort = 0;
      for (const q of arrSets) {
        const nConn = fnResolveDbConnId(e.nProductId, q.nDbConnectionId, arrDbConnections);
        if (nConn <= 0) continue;
        await conn.execute(
          `INSERT INTO event_template_query_set (n_event_template_id, n_sort, n_db_connection_id, str_default_items, str_query_template)
           VALUES (?,?,?,?,?)`,
          [e.nId, nSort, nConn, q.strDefaultItems ?? null, q.strQueryTemplate ?? ''],
        );
        nSort += 1;
      }
    }
  }

  // 인스턴스만 있고 events.json 에 해당 n_id 템플릿이 없으면 FK 실패 → 인스턴스 필드로 스텁 템플릿 보강
  const setEventTemplateIds = new Set(arrEvents.map((e) => e.nId));
  const arrMissingTplIds = [
    ...new Set(
      arrEventInstances
        .map((i) => i.nEventTemplateId)
        .filter((nId) => Number.isFinite(nId) && nId > 0 && !setEventTemplateIds.has(nId)),
    ),
  ];
  if (arrMissingTplIds.length > 0) {
    console.warn(
      `[DATA_MYSQL] events.json 에 없는 n_event_template_id | ${arrMissingTplIds.join(',')} | 스텁 event_template 삽입`,
    );
  }
  for (const nTplId of arrMissingTplIds) {
    const inst = arrEventInstances.find((i) => i.nEventTemplateId === nTplId);
    if (!inst) continue;
    await conn.execute(
      `INSERT INTO event_template (
        n_id, n_product_id, str_product_name, str_event_label, str_description, str_category, str_type,
        str_input_format, str_default_items, str_query_template, dt_created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        nTplId,
        inst.nProductId,
        inst.strProductName,
        inst.strEventLabel,
        'events.json에 해당 템플릿 없음 — 인스턴스 기준 스텁',
        inst.strCategory,
        inst.strType,
        'raw',
        null,
        null,
        fnToMysqlDatetime6Required(inst.dtCreatedAt, new Date().toISOString()),
      ],
    );
    setEventTemplateIds.add(nTplId);
  }

  for (const inst of arrEventInstances) {
    const strDeploy = fnToMysqlDatetime6Required(
      inst.dtDeployDate || inst.dtQaDeployDate || inst.dtLiveDeployDate,
      inst.dtCreatedAt,
    );
    await conn.execute(
      `INSERT INTO event_instance (
        n_id, n_event_template_id, n_product_id, str_event_label, str_product_name, str_service_abbr, str_service_region,
        str_category, str_type, str_event_name, str_input_values, str_generated_query, dt_deploy_date,
        dt_qa_deploy_date, dt_live_deploy_date, str_allo_link, str_status, str_created_by, n_created_by_user_id,
        dt_created_at, b_permanently_removed, dt_permanently_removed_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        inst.nId,
        inst.nEventTemplateId,
        inst.nProductId,
        inst.strEventLabel,
        inst.strProductName,
        inst.strServiceAbbr,
        inst.strServiceRegion,
        inst.strCategory,
        inst.strType,
        inst.strEventName,
        inst.strInputValues ?? null,
        inst.strGeneratedQuery ?? null,
        strDeploy,
        fnToMysqlDatetime6(inst.dtQaDeployDate ?? null),
        fnToMysqlDatetime6(inst.dtLiveDeployDate ?? null),
        inst.strAlloLink ?? null,
        inst.strStatus,
        inst.strCreatedBy,
        inst.nCreatedByUserId,
        fnToMysqlDatetime6Required(inst.dtCreatedAt, new Date().toISOString()),
        fnTiny(Boolean(inst.bPermanentlyRemoved)),
        fnToMysqlDatetime6(inst.dtPermanentlyRemovedAt ?? null),
      ],
    );
    for (const sc of inst.arrDeployScope ?? []) {
      await conn.execute(
        `INSERT INTO event_instance_deploy_scope (n_instance_id, str_scope) VALUES (?,?)`,
        [inst.nId, sc],
      );
    }
    let nEtSort = 0;
    for (const t of inst.arrExecutionTargets ?? []) {
      const nConn = fnResolveDbConnId(inst.nProductId, t.nDbConnectionId, arrDbConnections);
      if (nConn <= 0) continue;
      await conn.execute(
        `INSERT INTO event_instance_execution_target (n_instance_id, n_sort, n_db_connection_id, str_query) VALUES (?,?,?,?)`,
        [inst.nId, nEtSort, nConn, t.strQuery ?? ''],
      );
      nEtSort += 1;
    }
    let nLogSort = 0;
    for (const log of inst.arrStatusLogs ?? []) {
      await conn.execute(
        `INSERT INTO event_instance_status_log (
          n_instance_id, n_sort, str_status, str_changed_by, n_changed_by_user_id, str_comment, dt_changed_at, json_execution_result
        ) VALUES (?,?,?,?,?,?,?,?)`,
        [
          inst.nId,
          nLogSort,
          log.strStatus,
          log.strChangedBy,
          log.nChangedByUserId,
          log.strComment ?? null,
          fnToMysqlDatetime6Required(log.dtChangedAt, inst.dtCreatedAt),
          log.objExecutionResult != null ? JSON.stringify(log.objExecutionResult) : null,
        ],
      );
      nLogSort += 1;
    }
    const arrStages: Array<[keyof IEventInstance, string]> = [
      ['objCreator', 'creator'],
      ['objConfirmer', 'confirmer'],
      ['objQaRequester', 'qa_requester'],
      ['objQaDeployer', 'qa_deployer'],
      ['objQaVerifier', 'qa_verifier'],
      ['objLiveRequester', 'live_requester'],
      ['objLiveDeployer', 'live_deployer'],
      ['objLiveVerifier', 'live_verifier'],
    ];
    for (const [strKey, strStage] of arrStages) {
      const actor = inst[strKey] as IStageActor | null | undefined;
      if (!actor) continue;
      await conn.execute(
        `INSERT INTO event_instance_stage_actor (n_instance_id, str_stage, str_display_name, n_user_id, str_user_id, dt_processed_at)
         VALUES (?,?,?,?,?,?)`,
        [
          inst.nId,
          strStage,
          actor.strDisplayName,
          actor.nUserId,
          actor.strUserId,
          fnToMysqlDatetime6Required(actor.dtProcessedAt, inst.dtCreatedAt),
        ],
      );
    }
  }

  for (const log of p.arrActivityLogs) {
    await conn.execute(
      `INSERT INTO activity_log (
        n_id, dt_at, str_method, str_path, n_status_code, n_actor_user_id, str_actor_user_id, str_category, json_actor_roles
      ) VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        log.nId,
        fnToMysqlDatetime6Required(log.dtAt, new Date().toISOString()),
        log.strMethod,
        log.strPath,
        log.nStatusCode,
        log.nActorUserId,
        log.strActorUserId,
        log.strCategory,
        log.arrActorRoles != null ? JSON.stringify(log.arrActorRoles) : null,
      ],
    );
  }

  for (const [strUid, objEntries] of Object.entries(p.objUserUi.mapByUserId || {})) {
    const nUserId = Number(strUid);
    if (!Number.isFinite(nUserId) || nUserId <= 0) continue;
    for (const [strKey, strVal] of Object.entries(objEntries ?? {})) {
      await conn.execute(
        `INSERT INTO user_ui_preference (n_user_id, str_key, str_value) VALUES (?,?,?)`,
        [nUserId, strKey.slice(0, 256), strVal],
      );
    }
  }
};

/** UI 설정만 치환(전체 스냅샷보다 가벼움) */
export const fnRelationalReplaceUserUiOnly = async (
  pool: Pool,
  objRoot: { mapByUserId: Record<string, Record<string, string>> },
): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM user_ui_preference');
    for (const [strUid, objEntries] of Object.entries(objRoot.mapByUserId || {})) {
      const nUserId = Number(strUid);
      if (!Number.isFinite(nUserId) || nUserId <= 0) continue;
      for (const [strKey, strVal] of Object.entries(objEntries ?? {})) {
        await conn.execute(
          `INSERT INTO user_ui_preference (n_user_id, str_key, str_value) VALUES (?,?,?)`,
          [nUserId, strKey.slice(0, 256), strVal],
        );
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

export const fnRelationalReplaceFullFromImportPayload = async (
  pool: Pool,
  payload: IRelationalImportPayload,
): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await fnClearAllRelational(conn);
    await fnInsertPayload(conn, payload);
    await conn.commit();
    const nUiUsers = Object.keys(payload.objUserUi?.mapByUserId ?? {}).length;
    console.log(
      `[DATA_MYSQL] 정규화 적재 완료 | product=${payload.arrProducts.length} ` +
        `db_connection=${payload.arrDbConnections.length} event_template=${payload.arrEvents.length} ` +
        `event_instance=${payload.arrEventInstances.length} users=${payload.arrUsers.length} ` +
        `roles=${payload.arrRoles.length} user_roles=${payload.arrUserRoles.length} ` +
        `role_permissions=${payload.arrRolePermissions.length} activity_log=${payload.arrActivityLogs.length} ` +
        `user_ui_preference_users=${nUiUsers}`,
    );
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/** 인메모리 모듈 스냅샷 → DB (동적 import로 순환 참조 회피) */
export const fnRelationalWriteFullFromMemory = async (pool: Pool): Promise<void> => {
  const { arrProducts } = await import('../data/products');
  const { arrDbConnections } = await import('../data/dbConnections');
  const { arrEvents } = await import('../data/events');
  const { arrEventInstances } = await import('../data/eventInstances');
  const { arrUsers } = await import('../data/users');
  const { arrRoles } = await import('../data/roles');
  const { arrUserRoles } = await import('../data/userRoles');
  const { arrRolePermissions } = await import('../data/rolePermissions');
  const { arrActivityLogs } = await import('../data/activityLogs');
  const { fnGetUserUiRootForMysql } = await import('../data/userUiPreferences');

  const objUserUi = fnGetUserUiRootForMysql();

  await fnRelationalReplaceFullFromImportPayload(pool, {
    arrProducts: [...arrProducts],
    arrDbConnections: [...arrDbConnections],
    arrEvents: [...arrEvents],
    arrEventInstances: [...arrEventInstances],
    arrUsers: [...arrUsers] as IUserRowJson[],
    arrRoles: [...arrRoles] as IRoleRowJson[],
    arrUserRoles: [...arrUserRoles],
    arrRolePermissions: [...arrRolePermissions],
    arrActivityLogs: [...arrActivityLogs],
    objUserUi,
  });
};

const fnJsonVal = (raw: unknown): unknown => {
  if (raw == null) return null;
  if (typeof raw === 'string') return JSON.parse(raw);
  if (Buffer.isBuffer(raw)) return JSON.parse(raw.toString('utf8'));
  if (typeof raw === 'object') return raw;
  return JSON.parse(String(raw));
};

export const fnRelationalLoadProducts = async (pool: Pool): Promise<IProduct[]> => {
  const [prows] = await pool.query<RowDataPacket[]>('SELECT n_id, str_name, str_description, str_db_type, dt_created_at FROM product ORDER BY n_id');
  const [srows] = await pool.query<RowDataPacket[]>(
    'SELECT n_product_id, n_sort, str_abbr, str_region FROM product_service ORDER BY n_product_id, n_sort',
  );
  const mapSvc = new Map<number, Array<{ strAbbr: string; strRegion: string }>>();
  for (const s of srows) {
    const nPid = Number(s.n_product_id);
    if (!mapSvc.has(nPid)) mapSvc.set(nPid, []);
    mapSvc.get(nPid)!.push({ strAbbr: String(s.str_abbr), strRegion: String(s.str_region) });
  }
  return (prows as RowDataPacket[]).map((r) => ({
    nId: Number(r.n_id),
    strName: String(r.str_name),
    strDescription: r.str_description != null ? String(r.str_description) : '',
    strDbType: String(r.str_db_type),
    arrServices: mapSvc.get(Number(r.n_id)) ?? [],
    dtCreatedAt: new Date(r.dt_created_at as string | Date).toISOString(),
  }));
};

export const fnRelationalLoadDbConnections = async (pool: Pool): Promise<IDbConnection[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT n_id, n_product_id, str_product_name, str_kind, str_env, str_db_type, str_host, n_port,
            str_database, str_user, str_password, b_is_active, dt_created_at, dt_updated_at
     FROM db_connection ORDER BY n_id`,
  );
  return (rows as RowDataPacket[]).map((r) => ({
    nId: Number(r.n_id),
    nProductId: Number(r.n_product_id),
    strProductName: String(r.str_product_name),
    strKind: r.str_kind as IDbConnection['strKind'],
    strEnv: r.str_env as IDbConnection['strEnv'],
    strDbType: r.str_db_type as IDbConnection['strDbType'],
    strHost: String(r.str_host),
    nPort: Number(r.n_port),
    strDatabase: String(r.str_database),
    strUser: String(r.str_user),
    strPassword: String(r.str_password),
    bIsActive: Boolean(r.b_is_active),
    dtCreatedAt: new Date(r.dt_created_at as string | Date).toISOString(),
    dtUpdatedAt: new Date(r.dt_updated_at as string | Date).toISOString(),
  }));
};

export const fnRelationalLoadEvents = async (pool: Pool): Promise<IEventTemplate[]> => {
  const [trows] = await pool.query<RowDataPacket[]>(
    `SELECT n_id, n_product_id, str_product_name, str_event_label, str_description, str_category, str_type,
            str_input_format, str_default_items, str_query_template, dt_created_at FROM event_template ORDER BY n_id`,
  );
  const [qrows] = await pool.query<RowDataPacket[]>(
    `SELECT n_event_template_id, n_sort, n_db_connection_id, str_default_items, str_query_template
     FROM event_template_query_set ORDER BY n_event_template_id, n_sort`,
  );
  const mapQ = new Map<number, IQueryTemplateItem[]>();
  for (const q of qrows as RowDataPacket[]) {
    const tid = Number(q.n_event_template_id);
    if (!mapQ.has(tid)) mapQ.set(tid, []);
    mapQ.get(tid)!.push({
      nDbConnectionId: Number(q.n_db_connection_id),
      strDefaultItems: q.str_default_items != null ? String(q.str_default_items) : undefined,
      strQueryTemplate: String(q.str_query_template ?? ''),
    });
  }
  return (trows as RowDataPacket[]).map((r) => {
    const nId = Number(r.n_id);
    const arrQueryTemplates = mapQ.get(nId);
    return {
      nId,
      nProductId: Number(r.n_product_id),
      strProductName: String(r.str_product_name),
      strEventLabel: String(r.str_event_label),
      strDescription: r.str_description != null ? String(r.str_description) : '',
      strCategory: String(r.str_category),
      strType: String(r.str_type),
      strInputFormat: String(r.str_input_format),
      strDefaultItems: r.str_default_items != null ? String(r.str_default_items) : '',
      strQueryTemplate: r.str_query_template != null ? String(r.str_query_template) : '',
      arrQueryTemplates: arrQueryTemplates?.length ? arrQueryTemplates : undefined,
      dtCreatedAt: new Date(r.dt_created_at as string | Date).toISOString(),
    };
  });
};

export const fnRelationalLoadEventInstances = async (pool: Pool): Promise<IEventInstance[]> => {
  const [irows] = await pool.query<RowDataPacket[]>(`SELECT * FROM event_instance ORDER BY n_id`);
  const [dscopes] = await pool.query<RowDataPacket[]>(
    `SELECT n_instance_id, str_scope FROM event_instance_deploy_scope`,
  );
  const [etgt] = await pool.query<RowDataPacket[]>(
    `SELECT n_instance_id, n_sort, n_db_connection_id, str_query FROM event_instance_execution_target ORDER BY n_instance_id, n_sort`,
  );
  const [logs] = await pool.query<RowDataPacket[]>(
    `SELECT n_instance_id, n_sort, str_status, str_changed_by, n_changed_by_user_id, str_comment, dt_changed_at, json_execution_result
     FROM event_instance_status_log ORDER BY n_instance_id, n_sort`,
  );
  const [actors] = await pool.query<RowDataPacket[]>(
    `SELECT n_instance_id, str_stage, str_display_name, n_user_id, str_user_id, dt_processed_at FROM event_instance_stage_actor`,
  );

  const mapScope = new Map<number, Array<'qa' | 'live'>>();
  for (const r of dscopes as RowDataPacket[]) {
    const id = Number(r.n_instance_id);
    if (!mapScope.has(id)) mapScope.set(id, []);
    mapScope.get(id)!.push(String(r.str_scope) as 'qa' | 'live');
  }
  const mapEt = new Map<number, IExecutionTarget[]>();
  for (const r of etgt as RowDataPacket[]) {
    const id = Number(r.n_instance_id);
    if (!mapEt.has(id)) mapEt.set(id, []);
    mapEt.get(id)!.push({ nDbConnectionId: Number(r.n_db_connection_id), strQuery: String(r.str_query ?? '') });
  }
  const mapLog = new Map<number, IStatusLog[]>();
  for (const r of logs as RowDataPacket[]) {
    const id = Number(r.n_instance_id);
    if (!mapLog.has(id)) mapLog.set(id, []);
    let objExec: IStatusLog['objExecutionResult'] | undefined;
    if (r.json_execution_result != null) {
      try {
        objExec = fnJsonVal(r.json_execution_result) as IStatusLog['objExecutionResult'];
      } catch {
        objExec = undefined;
      }
    }
    const row: IStatusLog = {
      strStatus: String(r.str_status) as TEventStatus,
      strChangedBy: String(r.str_changed_by),
      nChangedByUserId: Number(r.n_changed_by_user_id),
      strComment: r.str_comment != null ? String(r.str_comment) : '',
      dtChangedAt: new Date(r.dt_changed_at as string | Date).toISOString(),
    };
    if (objExec !== undefined) row.objExecutionResult = objExec;
    mapLog.get(id)!.push(row);
  }
  const mapActor = new Map<string, IStageActor>();
  const fnActorKey = (iid: number, stage: string) => `${iid}:${stage}`;
  for (const r of actors as RowDataPacket[]) {
    mapActor.set(fnActorKey(Number(r.n_instance_id), String(r.str_stage)), {
      strDisplayName: String(r.str_display_name),
      nUserId: Number(r.n_user_id),
      strUserId: String(r.str_user_id),
      dtProcessedAt: new Date(r.dt_processed_at as string | Date).toISOString(),
    });
  }
  const fnPickActor = (iid: number, stage: string): IStageActor | null => mapActor.get(fnActorKey(iid, stage)) ?? null;

  return (irows as RowDataPacket[]).map((r) => {
    const nId = Number(r.n_id);
    const strDtDeploy = new Date(r.dt_deploy_date as string | Date).toISOString();
    return {
      nId,
      nEventTemplateId: Number(r.n_event_template_id),
      nProductId: Number(r.n_product_id),
      strEventLabel: String(r.str_event_label),
      strProductName: String(r.str_product_name),
      strServiceAbbr: String(r.str_service_abbr),
      strServiceRegion: String(r.str_service_region),
      strCategory: String(r.str_category),
      strType: String(r.str_type),
      strEventName: String(r.str_event_name),
      strInputValues: r.str_input_values != null ? String(r.str_input_values) : '',
      strGeneratedQuery: r.str_generated_query != null ? String(r.str_generated_query) : '',
      arrExecutionTargets: mapEt.get(nId),
      dtDeployDate: strDtDeploy,
      dtQaDeployDate: r.dt_qa_deploy_date
        ? new Date(r.dt_qa_deploy_date as string | Date).toISOString()
        : undefined,
      dtLiveDeployDate: r.dt_live_deploy_date
        ? new Date(r.dt_live_deploy_date as string | Date).toISOString()
        : undefined,
      strAlloLink: r.str_allo_link != null ? String(r.str_allo_link) : undefined,
      arrDeployScope: mapScope.get(nId) ?? [],
      strStatus: String(r.str_status) as TEventStatus,
      arrStatusLogs: mapLog.get(nId) ?? [],
      objCreator: fnPickActor(nId, 'creator'),
      objConfirmer: fnPickActor(nId, 'confirmer'),
      objQaRequester: fnPickActor(nId, 'qa_requester'),
      objQaDeployer: fnPickActor(nId, 'qa_deployer'),
      objQaVerifier: fnPickActor(nId, 'qa_verifier'),
      objLiveRequester: fnPickActor(nId, 'live_requester'),
      objLiveDeployer: fnPickActor(nId, 'live_deployer'),
      objLiveVerifier: fnPickActor(nId, 'live_verifier'),
      strCreatedBy: String(r.str_created_by),
      nCreatedByUserId: Number(r.n_created_by_user_id),
      dtCreatedAt: new Date(r.dt_created_at as string | Date).toISOString(),
      bPermanentlyRemoved: Boolean(r.b_permanently_removed),
      dtPermanentlyRemovedAt: r.dt_permanently_removed_at
        ? new Date(r.dt_permanently_removed_at as string | Date).toISOString()
        : undefined,
    };
  });
};

export const fnRelationalLoadUsers = async (pool: Pool): Promise<IUserRowJson[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT n_id, str_user_id, str_password, str_display_name, dt_created_at FROM users ORDER BY n_id',
  );
  return (rows as RowDataPacket[]).map((r) => ({
    nId: Number(r.n_id),
    strUserId: String(r.str_user_id),
    strPassword: String(r.str_password),
    strDisplayName: String(r.str_display_name),
    dtCreatedAt: new Date(r.dt_created_at as string | Date).toISOString(),
  }));
};

export const fnRelationalLoadRoles = async (pool: Pool): Promise<IRoleRowJson[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT n_id, str_code, str_display_name, str_description, b_is_system, dt_created_at, dt_updated_at FROM roles ORDER BY n_id',
  );
  return (rows as RowDataPacket[]).map((r) => ({
    nId: Number(r.n_id),
    strCode: String(r.str_code),
    strDisplayName: String(r.str_display_name),
    strDescription: r.str_description != null ? String(r.str_description) : '',
    bIsSystem: Boolean(r.b_is_system),
    dtCreatedAt: new Date(r.dt_created_at as string | Date).toISOString(),
    dtUpdatedAt: new Date(r.dt_updated_at as string | Date).toISOString(),
  }));
};

export const fnRelationalLoadUserRoles = async (
  pool: Pool,
): Promise<Array<{ nUserId: number; nRoleId: number }>> => {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT n_user_id, n_role_id FROM user_roles');
  return (rows as RowDataPacket[]).map((r) => ({ nUserId: Number(r.n_user_id), nRoleId: Number(r.n_role_id) }));
};

export const fnRelationalLoadRolePermissions = async (
  pool: Pool,
): Promise<Array<{ nRoleId: number; strPermission: string }>> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT n_role_id, str_permission FROM role_permissions',
  );
  return (rows as RowDataPacket[]).map((r) => ({
    nRoleId: Number(r.n_role_id),
    strPermission: String(r.str_permission),
  }));
};

export const fnRelationalLoadActivityLogs = async (pool: Pool): Promise<IActivityLogRow[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT n_id, dt_at, str_method, str_path, n_status_code, n_actor_user_id, str_actor_user_id, str_category, json_actor_roles
     FROM activity_log ORDER BY n_id`,
  );
  return (rows as RowDataPacket[]).map((r) => {
    let arrActorRoles: string[] | null = null;
    if (r.json_actor_roles != null) {
      try {
        const v = fnJsonVal(r.json_actor_roles);
        arrActorRoles = Array.isArray(v) ? (v as string[]) : null;
      } catch {
        arrActorRoles = null;
      }
    }
    return {
      nId: Number(r.n_id),
      dtAt: new Date(r.dt_at as string | Date).toISOString(),
      strMethod: String(r.str_method),
      strPath: String(r.str_path),
      nStatusCode: Number(r.n_status_code),
      nActorUserId: r.n_actor_user_id != null ? Number(r.n_actor_user_id) : null,
      strActorUserId: r.str_actor_user_id != null ? String(r.str_actor_user_id) : null,
      strCategory: String(r.str_category) as IActivityLogRow['strCategory'],
      arrActorRoles,
    };
  });
};

export const fnRelationalLoadUserUiRoot = async (
  pool: Pool,
): Promise<{ mapByUserId: Record<string, Record<string, string>> }> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT n_user_id, str_key, str_value FROM user_ui_preference',
  );
  const mapByUserId: Record<string, Record<string, string>> = {};
  for (const r of rows as RowDataPacket[]) {
    const uid = String(r.n_user_id);
    if (!mapByUserId[uid]) mapByUserId[uid] = {};
    mapByUserId[uid][String(r.str_key)] = String(r.str_value ?? '');
  }
  return { mapByUserId };
};
