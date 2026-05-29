/**
 * gm01+dba01 워크플로 probe / Playwright 공용 헬퍼
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
export const STR_CONFIG_PATH = resolve(__dir, 'e2e-workflow-config.json');

export const fnLoadWorkflowConfig = () => {
  if (!existsSync(STR_CONFIG_PATH)) return null;
  return JSON.parse(readFileSync(STR_CONFIG_PATH, 'utf8'));
};

export const fnApiLogin = async (strApi, strUser, strPass) => {
  const res = await fetch(`${strApi}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strUserId: strUser, strPassword: strPass }),
  });
  const obj = await res.json();
  if (!obj.strToken) throw new Error(`로그인 실패 ${strUser}`);
  return { strToken: obj.strToken, objUser: obj.user };
};

/** gm01 — event_created 인스턴스 API 생성 */
export const fnApiCreateWorkflowInstance = async (objCfg, strGmUser, strGmPass) => {
  const strApi = objCfg.strApiBase || 'http://localhost:4000/api';
  const { strToken, objUser } = await fnApiLogin(strApi, strGmUser, strGmPass);
  const strEventName = `${objCfg.strEventNamePrefix || '[E2E]'} SELECT ${Date.now()}`;
  const res = await fetch(`${strApi}/event-instances`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${strToken}` },
    body: JSON.stringify({
      nEventTemplateId: objCfg.nEventTemplateId,
      nProductId: objCfg.nProductId,
      strEventLabel: objCfg.strTemplateLabel,
      strProductName: objCfg.strProductName,
      strServiceAbbr: objCfg.strServiceAbbr,
      strServiceRegion: objCfg.strServiceRegion,
      strCategory: '기타',
      strType: '조회',
      strEventName,
      strInputValues: '',
      strGeneratedQuery: 'SELECT 1 AS n_e2e;',
      arrExecutionTargets: [{
        nDbConnectionId: objCfg.nDbConnectionIdQa,
        strQuery: 'SELECT 1 AS n_e2e;',
      }],
      dtQaDeployDate: objCfg.dtQaDeployDate,
      dtLiveDeployDate: objCfg.dtLiveDeployDate,
      dtDeployDate: objCfg.dtQaDeployDate,
      arrDeployScope: objCfg.arrDeployScope || ['qa', 'live'],
      strCreatedBy: objUser?.strDisplayName || strGmUser,
    }),
  });
  const obj = await res.json();
  if (!res.ok || !obj.objInstance?.nId) {
    throw new Error(`인스턴스 생성 실패: ${obj.strMessage || res.status}`);
  }
  return obj.objInstance.nId;
};

export const fnRowBtn = (row, strBtn) =>
  row.locator('button').filter({ hasText: new RegExp(`^${strBtn}$`) });

export const fnRowWithButton = (page, strBtn) =>
  page.locator('.ant-table tbody tr').filter({
    has: page.locator('button').filter({ hasText: new RegExp(`^${strBtn}$`) }),
  }).first();

export const fnRowByInstanceId = (page, nId) =>
  page.locator('.ant-table tbody tr').filter({
    has: page.locator('td').filter({ hasText: new RegExp(`^${nId}$`) }),
  });

export const fnFindRowByIdPaging = async (page, nId) => {
  for (let n = 0; n < 25; n++) {
    const row = fnRowByInstanceId(page, nId);
    if (await row.count()) return row.first();
    const next = page.locator('.ant-pagination-next:not(.ant-pagination-disabled)');
    if (!(await next.count())) break;
    await next.click();
    await page.waitForTimeout(400);
  }
  return null;
};

export const fnResolveWorkflowRow = async (page, nWorkflowId, strBtnFallback) => {
  if (nWorkflowId) {
    const row = await fnFindRowByIdPaging(page, nWorkflowId);
    if (row) return row;
    const byId = fnRowByInstanceId(page, nWorkflowId);
    if (await byId.count()) return byId.first();
  }
  return fnRowWithButton(page, strBtnFallback);
};

const ARR_E2E_CREATOR_LOGINS = ['gm01', 'dba01', process.env.E2E_GM2_USER_ID || process.env.E2E_GM02_USER_ID || 'gm02'];

/** gm01/dba01/gm02 생성 이벤트만 probe 대상 */
export const fnFetchAllowedCreatorUserIds = async (strApi) => {
  const set = new Set();
  for (const strUser of ARR_E2E_CREATOR_LOGINS) {
    const strPass = process.env[`E2E_${strUser.toUpperCase()}_PASSWORD`] || strUser;
    try {
      const { objUser } = await fnApiLogin(strApi, strUser, strPass);
      if (objUser?.nId) set.add(objUser.nId);
    } catch {
      /* gm02 없으면 생략 */
    }
  }
  return set;
};

export const fnAssertAllowedCreatorInstance = async (strApi, strToken, nId, setAllowed) => {
  const res = await fetch(`${strApi.replace(/\/$/, '')}/event-instances/${nId}`, {
    headers: { Authorization: `Bearer ${strToken}` },
  });
  const obj = await res.json();
  const inst = obj.objInstance;
  if (!inst) throw new Error(`#${nId} 없음`);
  if (inst.bPermanentlyRemoved) throw new Error(`#${nId} 삭제됨`);
  const nUid = inst.nCreatedByUserId;
  if (!setAllowed.has(nUid)) {
    throw new Error(`#${nId} 생성자 nUserId=${nUid} — E2E 허용: ${ARR_E2E_CREATOR_LOGINS.join(', ')}`);
  }
  return inst;
};
