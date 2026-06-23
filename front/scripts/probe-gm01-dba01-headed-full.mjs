/**
 * gm01 + dba01 headed 통합 (L1 투어 + L2/L3 §I 워크플로)
 * 사전: cd backend && npm run seed-e2e-workflow:fresh
 * DQPM_HEADED=1 DQPM_SLOW_MO=700 DQPM_STEP_MS=1800 node scripts/probe-gm01-dba01-headed-full.mjs
 * DQPM_FRESH=1 (기본) — config 기준 API로 event_created 신규 생성
 * DQPM_UI_CREATE=1 — D-05 이벤트 생성 UI 제출 추가
 */
import { chromium, expect } from '@playwright/test';
import { writeFileSync } from 'fs';
import {
  fnLoadWorkflowConfig,
  fnApiCreateWorkflowInstance,
  fnApiLogin,
  fnRowBtn,
  fnRowWithButton,
  fnRowByInstanceId,
  fnFindRowByIdPaging,
  fnResolveWorkflowRow,
  fnFetchAllowedCreatorUserIds,
  fnAssertAllowedCreatorInstance,
} from './probe-workflow-lib.mjs';

const strBase = process.env.DQPM_BASE || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const strGmUser = process.env.DQPM_GM_USER || 'gm01';
const strGmPass = process.env.DQPM_GM_PASS || 'gm01';
const strDbaUser = process.env.DQPM_DBA_USER || 'dba01';
const strDbaPass = process.env.DQPM_DBA_PASS || 'dba01';
const bHeaded = process.env.DQPM_HEADED === '1' || process.env.DQPM_HEADED === 'true';
const nSlowMo = Number(process.env.DQPM_SLOW_MO || 700);
const nStepMs = Number(process.env.DQPM_STEP_MS || 1800);
const nHeadedEndMs = Number(process.env.DQPM_HEADED_WAIT_MS || 20000);

const arrReport = [];
let nWorkflowId = null;

const fnLog = (strId, strDesc, strStatus, objExtra = {}) => {
  const obj = { strId, strDesc, strStatus, ...objExtra };
  arrReport.push(obj);
  console.log(`[${strStatus}] ${strId} ${strDesc}`, objExtra.nWorkflowId ? `#${objExtra.nWorkflowId}` : '');
};

const fnPause = async (page) => { await page.waitForTimeout(nStepMs); };

const fnShot = async (page, strName) => {
  await page.screenshot({ path: `scripts/probe-gm-dba-${strName}.png`, fullPage: true });
};

const fnLogin = async (page, strUser, strPass) => {
  await page.goto(`${strBase}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('input').first().fill(strUser);
  await page.locator('input[type="password"]').first().fill(strPass);
  await page.getByRole('button', { name: /로그인/ }).click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 });
};

const fnLogout = async (page) => {
  await fnCloseModals(page);
  try {
    await page.locator('.ant-layout-header .ant-dropdown-trigger').last().click({ timeout: 5000 });
    await page.locator('.ant-dropdown-menu-item').filter({ hasText: '로그아웃' }).click({ timeout: 5000 });
    await page.waitForURL(/\/login/, { timeout: 15000 });
  } catch {
    await page.evaluate(() => {
      localStorage.removeItem('strToken');
      localStorage.removeItem('user');
    });
    await page.goto(`${strBase}/login`, { waitUntil: 'domcontentloaded' });
  }
};

const fnSetDashFilter = async (page, strLabel) => {
  const combobox = page.locator('.ant-card .ant-select').first();
  await combobox.click();
  await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    .locator('.ant-select-item-option')
    .filter({ hasText: strLabel })
    .click();
  await page.waitForTimeout(800);
};

const fnGoMyDashboardForWorkflow = async (page) => {
  await fnGoMyDashboard(page);
  await fnSetDashFilter(page, '내가 생성한 이벤트').catch(() => {});
  await fnCloseModals(page);
};

const fnClickMenu = async (page, strLabel) => {
  const loc = page.locator('.ant-menu-title-content').filter({ hasText: strLabel });
  if (await loc.count()) await loc.first().click();
  else await page.getByRole('menuitem', { name: strLabel }).first().click();
};

const fnGoMyDashboard = async (page) => {
  await fnClickMenu(page, '나의 대시보드');
  await expect(page).toHaveURL(/\/my-dashboard/, { timeout: 15000 });
  await page.waitForSelector('.ant-table tbody tr', { timeout: 20000 });
};

const fnPopconfirmOk = async (page, strOk = /요청|확인|실행/) => {
  const pop = page.locator('.ant-popconfirm');
  await pop.waitFor({ state: 'visible', timeout: 8000 });
  await pop.getByRole('button', { name: strOk }).click();
  await page.waitForTimeout(1200);
};

const fnTryRowAction = async (page, strLogId, strDesc, strBtn, strPopOk, bGmDashFilter = false) => {
  if (bGmDashFilter) await fnGoMyDashboardForWorkflow(page);
  else await fnGoMyDashboard(page);
  const row = await fnResolveWorkflowRow(page, nWorkflowId, strBtn);
  if (!(await row.count()) || !(await fnRowBtn(row, strBtn).count())) {
    fnLog(strLogId, `${strDesc} — 버튼 없음`, 'skip');
    return false;
  }
  try {
    await fnRowBtn(row, strBtn).click({ timeout: 15000 });
    await fnPopconfirmOk(page, strPopOk);
    fnLog(strLogId, strDesc, 'ok', { nWorkflowId });
    return true;
  } catch (err) {
    fnLog(strLogId, `${strDesc} 실패: ${err?.message?.slice(0, 80)}`, 'skip');
    return false;
  }
};

const fnCreateEventViaUI = async (page, objCfg) => {
  await fnClickMenu(page, '이벤트 생성');
  await page.waitForURL(/\/query/, { timeout: 15000 });
  await page.locator('.ant-select').first().click();
  await page.locator('.ant-select-item-option').filter({ hasText: objCfg.strProductName }).first().click();
  await page.waitForTimeout(400);
  const svc = page.locator('.ant-card').filter({ hasText: '국가/플랫폼' }).locator('.ant-select');
  await svc.click();
  await page.locator('.ant-select-item-option').filter({ hasText: objCfg.strServiceAbbr }).first().click();
  await page.waitForTimeout(400);
  const tpl = page.locator('.ant-card').filter({ hasText: '쿼리 템플릿' }).locator('.ant-select');
  await tpl.click();
  await page.locator('.ant-select-item-option').filter({ hasText: objCfg.strTemplateLabel }).first().click();
  await page.waitForTimeout(400);
  const dtPast = new Date(Date.now() - 3600000);
  const strDt = dtPast.toISOString().slice(0, 19).replace('T', ' ');
  for (const strLabel of ['QA 반영 날짜', 'LIVE 반영 날짜']) {
    const dp = page.locator('.ant-form-item').filter({ hasText: strLabel }).locator('input');
    if (await dp.count()) {
      await dp.first().click();
      await dp.first().fill(strDt);
      await page.keyboard.press('Enter');
    }
  }
  await page.getByRole('button', { name: '이벤트 생성' }).click();
  await page.waitForURL(/\/my-dashboard/, { timeout: 30000 });
  const m = page.url().match(/nInstanceId=(\d+)/);
  return m ? Number(m[1]) : null;
};

const fnParsePoolIds = () => {
  const str = (process.env.DQPM_INSTANCE_POOL || process.env.E2E_INSTANCE_POOL || '').trim();
  if (!str) return [];
  const arr = [];
  for (const part of str.split(',')) {
    const seg = part.trim();
    if (seg.includes('-')) {
      const [a, b] = seg.split('-').map((s) => Number(s.trim()));
      for (let n = Math.min(a, b); n <= Math.max(a, b); n++) arr.push(n);
    } else {
      const n = Number(seg);
      if (Number.isFinite(n)) arr.push(n);
    }
  }
  return [...new Set(arr)];
};

/** API — gm01/dba01/gm02 생성 이벤트만 (풀·목록) */
const fnPickWorkflowInstanceId = async () => {
  const nEnv = Number(process.env.DQPM_WORKFLOW_ID);
  const api = strBase.replace(':5173', ':4000') + '/api';
  const setAllowed = await fnFetchAllowedCreatorUserIds(api);
  if (nEnv > 0) return nEnv;

  const arrPool = fnParsePoolIds();
  if (arrPool.length) {
    const { strToken } = await fnApiLogin(api, strGmUser, strGmPass);
    for (const nId of arrPool) {
      try {
        const inst = await fnAssertAllowedCreatorInstance(api, strToken, nId, setAllowed);
        if (!inst.bPermanentlyRemoved) return nId;
      } catch { /* skip */ }
    }
  }

  const res = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strUserId: strGmUser, strPassword: strGmPass }),
  });
  const obj = await res.json();
  const hdr = { Authorization: `Bearer ${obj.strToken}` };
  const arr = (await (await fetch(`${api}/event-instances`, { headers: hdr })).json()).arrInstances || [];
  const fnAllowed = (i) => setAllowed.has(i.nCreatedByUserId) && !i.bPermanentlyRemoved;

  return (
    arr.find((i) => i.strStatus === 'event_created' && fnAllowed(i))?.nId
    ?? arr.find((i) => i.strStatus === 'confirm_requested' && fnAllowed(i))?.nId
    ?? arr.find((i) => i.strStatus === 'dba_confirmed' && fnAllowed(i))?.nId
    ?? arr.find((i) => i.strStatus === 'qa_requested' && fnAllowed(i))?.nId
    ?? arr.find((i) => i.strStatus === 'live_verified' && fnAllowed(i))?.nId
    ?? null
  );
};

const fnCloseModals = async (page) => {
  for (let n = 0; n < 3; n++) {
    const modal = page.locator('.ant-modal-wrap:visible');
    if (!(await modal.count())) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
};

const browser = await chromium.launch({ headless: !bHeaded, slowMo: bHeaded ? nSlowMo : 0 });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

const fnWriteReport = () => {
  const objSummary = {
    strBase,
    nWorkflowId,
    nOk: arrReport.filter((r) => r.strStatus === 'ok').length,
    nSkip: arrReport.filter((r) => r.strStatus === 'skip').length,
    nFailDb: arrReport.filter((r) => r.strStatus === 'fail-db').length,
    arrReport,
  };
  writeFileSync('scripts/probe-gm01-dba01-headed-report.json', JSON.stringify(objSummary, null, 2));
  console.log(JSON.stringify(objSummary, null, 2));
  return objSummary;
};

const objCfg = fnLoadWorkflowConfig();
const bFresh = process.env.DQPM_FRESH !== '0' && process.env.DQPM_FRESH !== 'false';
const bUiCreate = process.env.DQPM_UI_CREATE === '1' || process.env.DQPM_UI_CREATE === 'true';

try {
  const nEnvId = Number(process.env.DQPM_WORKFLOW_ID);
  if (nEnvId > 0) {
    nWorkflowId = nEnvId;
  } else if (objCfg && bFresh) {
    try {
      nWorkflowId = await fnApiCreateWorkflowInstance(objCfg, strGmUser, strGmPass);
      console.log(`[prep] 신규 인스턴스 API 생성 #${nWorkflowId}`);
    } catch (err) {
      console.warn('[prep] API 생성 실패, 기존 인스턴스 탐색', err?.message);
      nWorkflowId = await fnPickWorkflowInstanceId();
    }
  } else {
    nWorkflowId = await fnPickWorkflowInstanceId();
  }
  if (!objCfg) {
    console.warn('[prep] e2e-workflow-config.json 없음 — backend: npm run seed-e2e-workflow:fresh 권장');
  }
  if (nWorkflowId) {
    const api = strBase.replace(':5173', ':4000') + '/api';
    const setAllowed = await fnFetchAllowedCreatorUserIds(api);
    const { strToken } = await fnApiLogin(api, strGmUser, strGmPass);
    await fnAssertAllowedCreatorInstance(api, strToken, nWorkflowId, setAllowed);
    console.log(`[prep] 워크플로 대상 #${nWorkflowId} (생성자 E2E 허용)`);
  }
  // ── GM: 로그인·페이지 ──
  await fnLogin(page, strGmUser, strGmPass);
  fnLog('GM-A02', 'gm01 로그인', 'ok');
  await fnShot(page, 'gm-01-login');
  await fnPause(page);

  await fnClickMenu(page, '대시보드');
  await fnPause(page);
  fnLog('GM-B01', '대시보드', 'ok');
  await fnShot(page, 'gm-02-dashboard');

  await fnClickMenu(page, '프로덕트');
  await fnPause(page);
  fnLog('GM-B02', '프로덕트', 'ok');

  await fnClickMenu(page, '쿼리 템플릿');
  await fnPause(page);
  fnLog('GM-B03', '쿼리 템플릿', 'ok');

  await fnClickMenu(page, '이벤트 생성');
  await fnPause(page);
  fnLog('GM-B08', '이벤트 생성 /query', 'ok');
  await fnShot(page, 'gm-03-query');

  if (bUiCreate && objCfg) {
    try {
      const nUiId = await fnCreateEventViaUI(page, objCfg);
      if (nUiId) {
        nWorkflowId = nUiId;
        fnLog('GM-D05', '이벤트 생성 UI 제출', 'ok', { nWorkflowId });
        await fnShot(page, 'gm-03b-query-submitted');
      } else {
        fnLog('GM-D05', '이벤트 생성 UI — 인스턴스 ID 미확인', 'skip');
      }
    } catch (err) {
      fnLog('GM-D05', `이벤트 생성 UI 실패: ${err?.message?.slice(0, 80)}`, 'skip');
    }
    await fnPause(page);
  }

  // ── GM: 컨펌 요청 (본인 event_created) ──
  await fnGoMyDashboardForWorkflow(page);
  let rowConfirmReq = nWorkflowId
    ? (await fnFindRowByIdPaging(page, nWorkflowId)) || fnRowByInstanceId(page, nWorkflowId)
    : fnRowWithButton(page, '컨펌 요청');
  if (!(await fnRowBtn(rowConfirmReq, '컨펌 요청').count())) {
    rowConfirmReq = fnRowWithButton(page, '컨펌 요청');
  }
  if (!(await fnRowBtn(rowConfirmReq, '컨펌 요청').count())) {
    fnLog('GM-E03', '컨펌 요청 가능 행 없음 (본인 생성 event_created 없음)', 'skip');
  } else {
    await fnRowBtn(rowConfirmReq, '컨펌 요청').click();
    await fnPopconfirmOk(page, /요청/);
    fnLog('GM-E03', '컨펌 요청 클릭', 'ok', { nWorkflowId });
    await fnShot(page, 'gm-04-confirm-requested');
    await fnPause(page);
  }

  await fnLogout(page);
  fnLog('GM-A04', 'gm01 로그아웃', 'ok');
  await fnPause(page);

  // ── DBA: 로그인·컨펌 ──
  await fnLogin(page, strDbaUser, strDbaPass);
  fnLog('DBA-A02', 'dba01 로그인', 'ok');
  await fnShot(page, 'dba-01-login');
  await fnPause(page);

  await fnGoMyDashboard(page);
  await fnSetDashFilter(page, '내가 처리할 이벤트').catch(() => {});
  let rowDbaConfirm = null;
  if (nWorkflowId) {
    rowDbaConfirm = page.locator('.ant-table tbody tr').filter({
      has: page.locator('td').filter({ hasText: new RegExp(`^${nWorkflowId}$`) }),
      hasText: '컨펌 요청',
    });
    if (!(await rowDbaConfirm.count())) {
      rowDbaConfirm = await fnFindRowByIdPaging(page, nWorkflowId);
    } else {
      rowDbaConfirm = rowDbaConfirm.first();
    }
  }
  if (!rowDbaConfirm || !(await fnRowBtn(rowDbaConfirm, '컨펌').count())) {
    const rowFirst = page.locator('.ant-table tbody tr').filter({
      has: page.locator('button').filter({ hasText: /^컨펌$/ }),
    }).first();
    if (await fnRowBtn(rowFirst, '컨펌').count()) {
      await fnRowBtn(rowFirst, '컨펌').click();
      await fnPopconfirmOk(page, /확인/);
      fnLog('DBA-E04', 'DBA 컨펌 (목록 첫 행)', 'ok', { nWorkflowId });
      await fnShot(page, 'dba-02-confirmed');
      await fnPause(page);
    } else {
      fnLog('DBA-E04', 'DBA 컨펌 가능 행 없음', 'skip');
    }
  } else {
    await fnRowBtn(rowDbaConfirm, '컨펌').click();
    await fnPopconfirmOk(page, /확인/);
    fnLog('DBA-E04', 'DBA 컨펌', 'ok', { nWorkflowId });
    await fnShot(page, 'dba-02-confirmed');
    await fnPause(page);
  }

  await fnClickMenu(page, '대시보드');
  await fnClickMenu(page, '프로덕트');
  await fnClickMenu(page, '쿼리 템플릿');
  fnLog('DBA-B', 'dba 메뉴(대시보드·프로덕트·템플릿)', 'ok');
  await fnPause(page);

  await fnLogout(page);
  fnLog('DBA-A04', 'dba01 로그아웃', 'ok');
  await fnPause(page);

  // ── GM: QA 실행 요청 ──
  await fnLogin(page, strGmUser, strGmPass);
  await fnGoMyDashboardForWorkflow(page);
  let rowQaReq = nWorkflowId
    ? (await fnFindRowByIdPaging(page, nWorkflowId)) || fnRowByInstanceId(page, nWorkflowId)
    : fnRowWithButton(page, 'QA 쿼리 실행 요청');
  if (!(await rowQaReq.count()) || !(await fnRowBtn(rowQaReq, 'QA 쿼리 실행 요청').count())) {
    fnLog('GM-E05', 'QA 쿼리 실행 요청 행 없음 (DBA 컨펌 미완료 등)', 'skip');
  } else {
    try {
      await fnRowBtn(rowQaReq, 'QA 쿼리 실행 요청').click({ timeout: 15000 });
      await fnPopconfirmOk(page, /요청/);
      fnLog('GM-E05', 'QA 쿼리 실행 요청', 'ok', { nWorkflowId });
      await fnShot(page, 'gm-05-qa-requested');
      await fnPause(page);
    } catch (err) {
      fnLog('GM-E05', `QA 쿼리 실행 요청 실패: ${err?.message?.slice(0, 80)}`, 'skip');
    }
  }

  await fnLogout(page);

  // ── DBA: QA 실행 ──
  await fnLogin(page, strDbaUser, strDbaPass);
  await fnGoMyDashboard(page);
  let rowQaExec = nWorkflowId
    ? (await fnFindRowByIdPaging(page, nWorkflowId)) || fnRowByInstanceId(page, nWorkflowId)
    : fnRowWithButton(page, 'QA 쿼리 실행');
  await fnSetDashFilter(page, '내가 처리할 이벤트').catch(() => {});
  if (!(await rowQaExec.count()) || !(await fnRowBtn(rowQaExec, 'QA 쿼리 실행').count())) {
    rowQaExec = fnRowWithButton(page, 'QA 쿼리 실행');
  }
  if (!(await rowQaExec.count()) || !(await fnRowBtn(rowQaExec, 'QA 쿼리 실행').count())) {
    fnLog('DBA-E06', 'QA 쿼리 실행 행 없음', 'skip');
  } else {
    await fnRowBtn(rowQaExec, 'QA 쿼리 실행').click({ timeout: 15000 });
    await fnPopconfirmOk(page, /실행/);
    const modal = page.locator('.ant-modal');
    await modal.waitFor({ state: 'visible', timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const strModal = (await modal.innerText().catch(() => '')) || '';
    const bSuccess = /성공적으로 실행/.test(strModal);
    const bFail = /실행 실패|실패/.test(strModal);
    const bSelectRows = /행 조회|조회\s*\d+\s*행/.test(strModal);
    fnLog('DBA-E06', 'QA 쿼리 실행 모달', bSuccess ? 'ok' : bFail ? 'fail-db' : 'unknown', {
      nWorkflowId,
      bSuccess,
      bFail,
      bSelectRows,
      strSnippet: strModal.slice(0, 200),
    });
    if (bSuccess && bSelectRows) fnLog('GM-F02', 'SELECT N행 조회 UI', 'ok', { nWorkflowId });
    await fnShot(page, 'dba-03-qa-modal');
    await page.keyboard.press('Escape');
    await fnPause(page);
  }

  // 상세·이력
  await fnGoMyDashboard(page);
  const rowDetail = nWorkflowId
    ? (await fnFindRowByIdPaging(page, nWorkflowId)) || fnRowByInstanceId(page, nWorkflowId)
    : page.locator('.ant-table tbody tr').first();
  if (await fnRowBtn(rowDetail, '상세').count()) {
    await fnRowBtn(rowDetail, '상세').click();
    const modal = page.locator('.ant-modal').filter({ hasText: '이벤트 상세' });
    await modal.waitFor({ state: 'visible', timeout: 10000 });
    const btnHist = modal.getByRole('button', { name: /진행 이력/ }).first();
    if (await btnHist.count()) await btnHist.click();
    await page.waitForTimeout(800);
    await fnShot(page, 'dba-04-detail-history');
    fnLog('DBA-E-X1', '상세·진행 이력', 'ok', { nWorkflowId });
  }

  try {
    await fnLogout(page);
    fnLog('DBA-A04', 'dba01 로그아웃', 'ok');
  } catch {
    fnLog('DBA-A04', 'dba01 로그아웃', 'skip');
  }

  // ── GM: QA확인 → LIVE 요청·실행·LIVE확인 (qa_deployed 이후) ──
  await fnLogin(page, strGmUser, strGmPass);
  if (await fnTryRowAction(page, 'GM-E07', 'QA확인', 'QA확인', /확인/, true)) {
    await fnShot(page, 'gm-06-qa-verified');
    await fnPause(page);
  }
  await fnLogout(page);

  await fnLogin(page, strGmUser, strGmPass);
  if (await fnTryRowAction(page, 'GM-E08', 'LIVE 쿼리 실행 요청', 'LIVE 쿼리 실행 요청', /요청/, true)) {
    await fnShot(page, 'gm-07-live-requested');
    await fnPause(page);
  }
  await fnLogout(page);

  await fnLogin(page, strDbaUser, strDbaPass);
  await fnGoMyDashboard(page);
  await fnSetDashFilter(page, '내가 처리할 이벤트').catch(() => {});
  const rowLive = await fnResolveWorkflowRow(page, nWorkflowId, 'LIVE 쿼리 실행');
  if (await rowLive.count() && await fnRowBtn(rowLive, 'LIVE 쿼리 실행').count()) {
    await fnRowBtn(rowLive, 'LIVE 쿼리 실행').click({ timeout: 15000 });
    await fnPopconfirmOk(page, /실행/);
    const modalLive = page.locator('.ant-modal');
    await modalLive.waitFor({ state: 'visible', timeout: 120000 }).catch(() => {});
    const strLive = (await modalLive.innerText().catch(() => '')) || '';
    const bLiveOk = /성공적으로 실행/.test(strLive);
    fnLog('DBA-E09', 'LIVE 쿼리 실행 모달', bLiveOk ? 'ok' : 'fail-db', { nWorkflowId, strSnippet: strLive.slice(0, 160) });
    await fnShot(page, 'dba-05-live-modal');
    await page.keyboard.press('Escape');
  } else {
    fnLog('DBA-E09', 'LIVE 쿼리 실행 행 없음', 'skip');
  }
  try { await fnLogout(page); } catch { fnLog('DBA-A04c', '로그아웃', 'skip'); }

  await fnLogin(page, strGmUser, strGmPass);
  if (await fnTryRowAction(page, 'GM-E10', 'LIVE확인', 'LIVE확인', /확인/, true)) {
    await fnShot(page, 'gm-08-live-verified');
  }
  await fnLogout(page);

  const objSummary = fnWriteReport();

  if (bHeaded) {
    console.log(`[headed] ${nHeadedEndMs / 1000}초 유지`);
    await page.waitForTimeout(nHeadedEndMs);
  }
} catch (err) {
  console.error('PROBE_ABORT', err?.message || err);
  await fnShot(page, 'error').catch(() => {});
  fnWriteReport();
  process.exitCode = 1;
  if (bHeaded) await page.waitForTimeout(10000).catch(() => {});
} finally {
  await browser.close();
}
