import { readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  fnApiGetInstance,
  fnAssertE2eAllowedCreator,
  fnFetchAllowedCreatorUserIds,
} from './e2eCreators';

const __dir = dirname(fileURLToPath(import.meta.url));

export type TE2eWorkflowConfig = {
  strApiBase?: string;
  strTemplateLabel: string;
  nEventTemplateId: number;
  nProductId: number;
  strProductName: string;
  strServiceAbbr: string;
  strServiceRegion: string;
  nDbConnectionIdQa: number;
  nDbConnectionIdLive?: number;
  dtQaDeployDate: string;
  dtLiveDeployDate: string;
  arrDeployScope?: string[];
  strEventNamePrefix?: string;
  nFreshInstanceId?: number;
};

const STR_CONFIG = resolve(__dir, '../../scripts/e2e-workflow-config.json');

export const fnLoadE2eWorkflowConfig = (): TE2eWorkflowConfig | null => {
  if (!existsSync(STR_CONFIG)) return null;
  return JSON.parse(readFileSync(STR_CONFIG, 'utf8')) as TE2eWorkflowConfig;
};

export const fnApiLoginToken = async (
  strApiBase: string,
  strUserId: string,
  strPassword: string,
): Promise<string> => {
  const res = await fetch(`${strApiBase.replace(/\/$/, '')}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strUserId, strPassword }),
  });
  const obj = await res.json();
  if (!obj.strToken) throw new Error(`로그인 실패: ${strUserId}`);
  return obj.strToken as string;
};

export const fnApiCreateWorkflowInstance = async (
  objCfg: TE2eWorkflowConfig,
  strGmToken: string,
  strGmDisplayName: string,
): Promise<number> => {
  const strApi = (objCfg.strApiBase || 'http://localhost:4000/api').replace(/\/$/, '');
  const strEventName = `${objCfg.strEventNamePrefix || '[E2E]'} API ${Date.now()}`;
  const res = await fetch(`${strApi}/event-instances`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${strGmToken}` },
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
        nQaDbConnectionId: objCfg.nDbConnectionIdQa,
        nLiveDbConnectionId: objCfg.nDbConnectionIdLive ?? objCfg.nDbConnectionIdQa,
        strQuery: 'SELECT 1 AS n_e2e;',
      }],
      dtQaDeployDate: objCfg.dtQaDeployDate,
      dtLiveDeployDate: objCfg.dtLiveDeployDate,
      dtDeployDate: objCfg.dtQaDeployDate,
      arrDeployScope: objCfg.arrDeployScope || ['qa', 'live'],
      strCreatedBy: strGmDisplayName,
    }),
  });
  const obj = await res.json();
  if (!res.ok || !obj.objInstance?.nId) {
    throw new Error(obj.strMessage || `인스턴스 생성 ${res.status}`);
  }
  return obj.objInstance.nId as number;
};

/** API 생성·고정 ID 공통 — gm01/dba01/gm02 생성 이벤트만 허용 */
export const fnAssertWorkflowInstanceAllowed = async (
  strApiBase: string,
  nInstanceId: number,
  strGmToken: string,
): Promise<void> => {
  const setAllowed = await fnFetchAllowedCreatorUserIds(strApiBase);
  const obj = await fnApiGetInstance(strApiBase, strGmToken, nInstanceId);
  if (!obj) throw new Error(`인스턴스 #${nInstanceId} 없음`);
  fnAssertE2eAllowedCreator(obj, setAllowed);
};

export { fnApiGetInstance, fnAssertE2eAllowedCreator, fnFetchAllowedCreatorUserIds };
