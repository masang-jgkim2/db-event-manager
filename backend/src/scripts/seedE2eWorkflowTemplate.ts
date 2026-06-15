/**
 * E2E 워크플로용 SELECT 템플릿 + 설정 JSON 생성
 * 사용: cd backend && npm run seed-e2e-workflow
 * 옵션: --create-instance → gm01으로 event_created 인스턴스 1건 추가 생성
 */
import 'dotenv/config';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const STR_API = (process.env.E2E_API_BASE || 'http://localhost:4000/api').replace(/\/$/, '');
const STR_WORKFLOW_KIND = (process.env.E2E_WORKFLOW_KIND || 'select').toLowerCase();
const STR_TEMPLATE_LABEL =
  process.env.E2E_TEMPLATE_LABEL
  || (STR_WORKFLOW_KIND === 'insert' ? 'E2E_INSERT_워크플로' : 'E2E_SELECT_워크플로');
/** MSSQL QA — temp # 테이블 INSERT 1건 후 DROP (롤백 가능 트랜잭션 내) */
const STR_QUERY_INSERT =
  'CREATE TABLE #e2e_dqpm (n INT);\nINSERT INTO #e2e_dqpm (n) VALUES (1);\nDROP TABLE #e2e_dqpm;';
const STR_QUERY_TEMPLATE =
  process.env.E2E_QUERY_TEMPLATE
  || (STR_WORKFLOW_KIND === 'insert' ? STR_QUERY_INSERT : 'SELECT 1 AS n_e2e;');
const STR_ADMIN_USER = process.env.E2E_USER_ID || 'admin';
const STR_ADMIN_PASS = process.env.E2E_PASSWORD || 'admin123';
const STR_GM_USER = process.env.E2E_GM_USER_ID || 'gm01';
const STR_GM_PASS = process.env.E2E_GM_PASSWORD || 'gm01';
const N_PRODUCT_ID = Number(process.env.E2E_PRODUCT_ID || 0);
const STR_CONFIG_PATH = resolve(
  process.env.E2E_WORKFLOW_CONFIG_PATH
    || resolve(process.cwd(), '../front/scripts/e2e-workflow-config.json'),
);

interface ILoginResponse {
  strToken?: string;
  strMessage?: string;
  user?: { nId?: number; strDisplayName?: string };
}

interface IProduct {
  nId: number;
  strName?: string;
  arrServices?: Array<{ strAbbr: string; strRegion: string }>;
}

interface IDbConnection {
  nId: number;
  nProductId: number;
  strEnv: string;
  bIsActive?: boolean;
}

const fnLogin = async (strUserId: string, strPassword: string) => {
  const res = await fetch(`${STR_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strUserId, strPassword }),
  });
  const obj = (await res.json()) as ILoginResponse;
  if (!obj.strToken) throw new Error(`로그인 실패: ${strUserId} ${obj.strMessage || res.status}`);
  return { strToken: obj.strToken, objUser: obj.user };
};

const fnGet = async <T>(strPath: string, strToken: string): Promise<T> => {
  const res = await fetch(`${STR_API}${strPath}`, {
    headers: { Authorization: `Bearer ${strToken}` },
  });
  const obj = (await res.json()) as T;
  if (!res.ok) throw new Error(`GET ${strPath} → ${res.status} ${JSON.stringify(obj).slice(0, 200)}`);
  return obj;
};

const fnPost = async <T>(strPath: string, strToken: string, body: unknown) => {
  const res = await fetch(`${STR_API}${strPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${strToken}` },
    body: JSON.stringify(body),
  });
  const obj = (await res.json()) as T;
  return { res, obj };
};

const fnPickProduct = async (strToken: string) => {
  const obj = await fnGet<{ arrProducts?: IProduct[] }>('/products', strToken);
  const arr = obj.arrProducts || [];
  if (N_PRODUCT_ID > 0) {
    const p = arr.find((x) => x.nId === N_PRODUCT_ID);
    if (!p) throw new Error(`E2E_PRODUCT_ID=${N_PRODUCT_ID} 없음`);
    return p;
  }
  const objConn = await fnGet<{ arrDbConnections?: IDbConnection[] }>('/db-connections', strToken);
  const arrConn = (objConn.arrDbConnections || []).filter((c) => c.bIsActive !== false);
  const setQaProduct = new Set(
    arrConn.filter((c) => c.strEnv === 'qa').map((c) => c.nProductId),
  );
  const p = arr.find((x) => setQaProduct.has(x.nId));
  if (!p) throw new Error('QA DB 접속이 있는 프로덕트 없음');
  return p;
};

const fnMain = async () => {
  const bCreateInstance = process.argv.includes('--create-instance');
  const { strToken: strAdminToken } = await fnLogin(STR_ADMIN_USER, STR_ADMIN_PASS);

  const objProduct = await fnPickProduct(strAdminToken);
  const nProductId = objProduct.nId;
  const objSvc = objProduct.arrServices?.[0];
  if (!objSvc) throw new Error(`프로덕트 ${nProductId} 서비스 없음`);

  const objConnList = await fnGet<{ arrDbConnections?: IDbConnection[] }>('/db-connections', strAdminToken);
  const nConnQa = (objConnList.arrDbConnections || []).find(
    (c) => c.nProductId === nProductId && c.strEnv === 'qa',
  )?.nId;
  if (!nConnQa) throw new Error(`프로덕트 ${nProductId} QA 접속 없음`);

  const objEvents = await fnGet<{ arrEvents?: Array<{ nId: number; strEventLabel: string }> }>('/events', strAdminToken);
  let nTemplateId = (objEvents.arrEvents || []).find(
    (e) => e.strEventLabel === STR_TEMPLATE_LABEL,
  )?.nId;

  if (!nTemplateId) {
    const { res, obj } = await fnPost<{ objEvent?: { nId: number } }>('/events', strAdminToken, {
      nProductId,
      strEventLabel: STR_TEMPLATE_LABEL,
      strDescription: `E2E headed/workflow — ${STR_WORKFLOW_KIND}`,
      strCategory: '기타',
      strType: STR_WORKFLOW_KIND === 'insert' ? '변경' : '조회',
      strInputFormat: 'none',
      strDefaultItems: '',
      strQueryTemplate: STR_QUERY_TEMPLATE,
      arrQueryTemplates: [{ nDbConnectionId: nConnQa, strDefaultItems: '', strQueryTemplate: STR_QUERY_TEMPLATE }],
    });
    if (!res.ok || !obj.objEvent?.nId) {
      throw new Error(`템플릿 생성 실패: ${res.status} ${JSON.stringify(obj).slice(0, 300)}`);
    }
    nTemplateId = obj.objEvent.nId;
    console.log(`[seed-e2e] 템플릿 생성 #${nTemplateId} ${STR_TEMPLATE_LABEL}`);
  } else {
    console.log(`[seed-e2e] 기존 템플릿 #${nTemplateId} ${STR_TEMPLATE_LABEL}`);
  }

  const dtPast = new Date(Date.now() - 3600000).toISOString();
  const objConfig: Record<string, unknown> = {
    strApiBase: STR_API,
    strTemplateLabel: STR_TEMPLATE_LABEL,
    nEventTemplateId: nTemplateId,
    nProductId,
    strProductName: objProduct.strName,
    strServiceAbbr: objSvc.strAbbr,
    strServiceRegion: objSvc.strRegion,
    nDbConnectionIdQa: nConnQa,
    dtQaDeployDate: dtPast,
    dtLiveDeployDate: dtPast,
    arrDeployScope: ['qa', 'live'],
    strEventNamePrefix: '[E2E]',
  };

  let nInstanceId: number | null = null;
  if (bCreateInstance) {
    const { strToken: strGmToken, objUser } = await fnLogin(STR_GM_USER, STR_GM_PASS);
    const strEventName = `[E2E] SELECT 워크플로 ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
    const { res, obj } = await fnPost<{ objInstance?: { nId: number } }>('/event-instances', strGmToken, {
      nEventTemplateId: nTemplateId,
      nProductId,
      strEventLabel: STR_TEMPLATE_LABEL,
      strProductName: objProduct.strName,
      strServiceAbbr: objSvc.strAbbr,
      strServiceRegion: objSvc.strRegion,
      strCategory: '기타',
      strType: '조회',
      strEventName,
      strInputValues: '',
      strGeneratedQuery: STR_QUERY_TEMPLATE,
      arrExecutionTargets: [{ nDbConnectionId: nConnQa, strQuery: STR_QUERY_TEMPLATE }],
      dtQaDeployDate: dtPast,
      dtLiveDeployDate: dtPast,
      dtDeployDate: dtPast,
      arrDeployScope: ['qa', 'live'],
      strCreatedBy: objUser?.strDisplayName || STR_GM_USER,
      nCreatedByUserId: objUser?.nId,
    });
    if (!res.ok || !obj.objInstance?.nId) {
      throw new Error(`인스턴스 생성 실패: ${res.status} ${JSON.stringify(obj).slice(0, 300)}`);
    }
    nInstanceId = obj.objInstance.nId;
    objConfig.nFreshInstanceId = nInstanceId;
    console.log(`[seed-e2e] 인스턴스 생성 #${nInstanceId} (gm01, event_created)`);
  }

  writeFileSync(STR_CONFIG_PATH, JSON.stringify(objConfig, null, 2), 'utf8');
  console.log(`[seed-e2e] 설정 저장 → ${STR_CONFIG_PATH}`);
};

fnMain().catch((err) => {
  console.error('[seed-e2e] 실패', err);
  process.exit(1);
});
