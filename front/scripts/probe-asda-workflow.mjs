/**
 * 아스다글로벌(#4) AD/G — 이벤트 생성·QA/LIVE 실행 probe
 * 사용: npm run probe:asda  (front, backend :4000·front :5173 기동)
 * 환경: DQPM_UI_ONLY=1(UI만) | DQPM_CLEANUP=1(API 성공 시 생성 인스턴스 삭제)
 * API 경로는 템플릿 #36 메타만 쓰고 strGeneratedQuery는 SELECT 1(파괴적 DELETE 회피)
 */
import { chromium } from '@playwright/test';

const STR_API = (process.env.DQPM_API || 'http://127.0.0.1:4000/api').replace(/\/$/, '');
const STR_BASE = process.env.DQPM_BASE || 'http://127.0.0.1:5173';
const STR_USER = process.env.DQPM_USER || 'admin';
const STR_PASS = process.env.DQPM_PASS || 'admin123';

const N_PRODUCT_ID = 4;
const N_TEMPLATE_ID = 36;
const N_CONN_QA = 19;
const STR_SERVICE = 'AD/G';
const STR_SAFE_QUERY = 'SELECT 1 AS n_asda_probe;';

const arrReport = [];
const fnLog = (strId, strStatus, strDetail = '') => {
  const row = { strId, strStatus, strDetail };
  arrReport.push(row);
  const mark = strStatus === 'PASS' ? '✓' : strStatus === 'FAIL' ? '✗' : '·';
  console.log(`[${mark}] ${strId}${strDetail ? ` | ${strDetail}` : ''}`);
};

const fnApi = async (strPath, objOpts = {}) => {
  const res = await fetch(`${STR_API}${strPath}`, objOpts);
  const obj = await res.json().catch(() => ({}));
  return { res, obj };
};

const fnLogin = async () => {
  const { res, obj } = await fnApi('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strUserId: STR_USER, strPassword: STR_PASS }),
  });
  if (!res.ok || !obj.strToken) throw new Error(`로그인 실패: ${obj.strMessage || res.status}`);
  return { strToken: obj.strToken, objUser: obj.user };
};

const fnAuthHdr = (strToken) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${strToken}`,
});

const fnPatchStatus = async (strToken, nId, strNextStatus) => {
  const { res, obj } = await fnApi(`/event-instances/${nId}/status`, {
    method: 'PATCH',
    headers: fnAuthHdr(strToken),
    body: JSON.stringify({ strNextStatus, strComment: `[probe-asda] ${strNextStatus}` }),
  });
  if (!res.ok) throw new Error(`${strNextStatus}: ${obj.strMessage || res.status}`);
  return obj.objInstance;
};

const fnRunApiWorkflow = async () => {
  const { strToken, objUser } = await fnLogin();
  fnLog('A01', 'PASS', `로그인 ${STR_USER}`);

  const strEventName = `[AD/G] probe ${Date.now()}`;
  const dtPast = '2020-01-01T00:00:00.000Z';
  const { res: resCreate, obj: objCreate } = await fnApi('/event-instances', {
    method: 'POST',
    headers: fnAuthHdr(strToken),
    body: JSON.stringify({
      nEventTemplateId: N_TEMPLATE_ID,
      nProductId: N_PRODUCT_ID,
      strEventLabel: '[AD] probe',
      strProductName: '아스다글로벌',
      strServiceAbbr: STR_SERVICE,
      strServiceRegion: '글로벌',
      strCategory: '이벤트',
      strType: '조회',
      strEventName,
      strInputValues: '',
      strGeneratedQuery: STR_SAFE_QUERY,
      arrExecutionTargets: [{ nDbConnectionId: N_CONN_QA, strQuery: STR_SAFE_QUERY }],
      dtQaDeployDate: dtPast,
      dtLiveDeployDate: dtPast,
      dtDeployDate: dtPast,
      arrDeployScope: ['qa', 'live'],
      strCreatedBy: objUser?.strDisplayName || STR_USER,
    }),
  });
  if (!resCreate.ok || !objCreate.objInstance?.nId) {
    throw new Error(`생성 실패: ${objCreate.strMessage || resCreate.status}`);
  }
  const nId = objCreate.objInstance.nId;
  fnLog('A02', 'PASS', `인스턴스 생성 #${nId} (${strEventName})`);

  let inst = await fnPatchStatus(strToken, nId, 'qa_requested');
  fnLog('A03', 'PASS', `QA 요청 → ${inst.strStatus}`);

  const { res: resQa, obj: objQa } = await fnApi(`/event-instances/${nId}/execute`, {
    method: 'POST',
    headers: fnAuthHdr(strToken),
    body: JSON.stringify({ strEnv: 'qa' }),
  });
  if (!resQa.ok || !objQa.bSuccess) {
    throw new Error(`QA 실행 실패: ${objQa.strMessage || resQa.status}`);
  }
  inst = objQa.objInstance;
  const bQaOk = inst.objExecutionResult?.bSuccess !== false;
  fnLog('A04', bQaOk ? 'PASS' : 'FAIL', `QA 실행 → ${inst.strStatus} success=${inst.objExecutionResult?.bSuccess}`);

  inst = await fnPatchStatus(strToken, nId, 'qa_verified');
  fnLog('A05', 'PASS', `QA 검증 → ${inst.strStatus}`);

  inst = await fnPatchStatus(strToken, nId, 'live_requested');
  fnLog('A06', 'PASS', `LIVE 요청 → ${inst.strStatus}`);

  const { res: resLive, obj: objLive } = await fnApi(`/event-instances/${nId}/execute`, {
    method: 'POST',
    headers: fnAuthHdr(strToken),
    body: JSON.stringify({ strEnv: 'live' }),
  });
  if (!resLive.ok || !objLive.bSuccess) {
    throw new Error(`LIVE 실행 실패: ${objLive.strMessage || resLive.status}`);
  }
  inst = objLive.objInstance;
  const bLiveOk = inst.objExecutionResult?.bSuccess !== false;
  fnLog('A07', bLiveOk ? 'PASS' : 'FAIL', `LIVE 실행 → ${inst.strStatus} success=${inst.objExecutionResult?.bSuccess}`);

  inst = await fnPatchStatus(strToken, nId, 'live_verified');
  fnLog('A08', 'PASS', `LIVE 검증(완료) → ${inst.strStatus}`);

  return { strToken, nId };
};

const fnRunUiProbe = async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(`${STR_BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('input').first().fill(STR_USER);
    await page.locator('input[type="password"]').first().fill(STR_PASS);
    await page.getByRole('button', { name: /로그인/ }).click();
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 });

    await page.goto(`${STR_BASE}/query`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    fnLog('U01', 'PASS', '이벤트 생성 페이지 진입');

    const selProduct = page.locator('.ant-card').filter({ hasText: '1. 프로덕트 선택' }).locator('.ant-select').first();
    await selProduct.click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
      .filter({ hasText: '아스다글로벌' })
      .first()
      .click();
    fnLog('U02', 'PASS', '프로덕트 아스다글로벌 선택');

    const selService = page.locator('.ant-card').filter({ hasText: /2\./ }).locator('.ant-select').first();
    await selService.click();
    await page.waitForTimeout(300);
    await page.keyboard.type('AD/G');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    const bWarn = await page.locator('.ant-alert-warning').filter({ hasText: /DB 접속 정보가 없습니다/ }).count();
    const bTplVisible = await page.locator('.ant-card').filter({ hasText: '3. 쿼리 템플릿 선택' }).isVisible();
    if (!bTplVisible) {
      fnLog('U03', 'FAIL', 'AD/G 선택 후 템플릿 단계 미표시');
    } else {
      fnLog('U03', bWarn ? 'FAIL' : 'PASS', bWarn ? 'QA/LIVE 접속 경고 표시됨' : 'AD/G 선택·접속 OK');
    }

    const selTpl = page.locator('.ant-card').filter({ hasText: '3. 쿼리 템플릿 선택' }).locator('.ant-select').first();
    await selTpl.click();
    const optTpl = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').first();
    if (await optTpl.count()) {
      await optTpl.click();
      fnLog('U04', 'PASS', '쿼리 템플릿 선택 가능');
    } else {
      fnLog('U04', 'FAIL', '선택 가능한 템플릿 없음');
    }

    await page.screenshot({ path: 'scripts/probe-asda-query-page.png', fullPage: true });
    fnLog('U05', 'PASS', '스크린샷 scripts/probe-asda-query-page.png');
  } finally {
    await browser.close();
  }
};

const fnDeleteInstance = async (strToken, nId) => {
  const { res, obj } = await fnApi(`/event-instances/${nId}`, {
    method: 'DELETE',
    headers: fnAuthHdr(strToken),
  });
  if (!res.ok) throw new Error(`삭제 실패 #${nId}: ${obj.strMessage || res.status}`);
};

const fnMain = async () => {
  console.log(`\n=== 아스다 AD/G 워크플로 probe | API=${STR_API} UI=${STR_BASE} ===\n`);
  let nId = null;
  let strToken = null;
  if (process.env.DQPM_UI_ONLY !== '1') {
    try {
      ({ strToken, nId } = await fnRunApiWorkflow());
    } catch (err) {
      fnLog('API', 'FAIL', err instanceof Error ? err.message : String(err));
    }
  }
  try {
    await fnRunUiProbe();
  } catch (err) {
    fnLog('UI', 'FAIL', err instanceof Error ? err.message : String(err));
  }

  let nFail = arrReport.filter((r) => r.strStatus === 'FAIL').length;
  const bCleanup = process.env.DQPM_CLEANUP !== '0';
  if (bCleanup && nId && strToken && nFail === 0) {
    try {
      await fnDeleteInstance(strToken, nId);
      fnLog('A99', 'PASS', `테스트 인스턴스 #${nId} 삭제`);
      nId = null;
    } catch (err) {
      fnLog('A99', 'FAIL', err instanceof Error ? err.message : String(err));
    }
  }
  nFail = arrReport.filter((r) => r.strStatus === 'FAIL').length;
  console.log(`\n=== 결과: ${arrReport.filter((r) => r.strStatus === 'PASS').length} PASS / ${nFail} FAIL ===`);
  if (nId && strToken) {
    console.log(`\n테스트 인스턴스 #${nId} 유지 (삭제: DQPM_CLEANUP=1 기본, 유지: DQPM_CLEANUP=0)`);
  }
  process.exit(nFail > 0 ? 1 : 0);
};

void fnMain();
