/**
 * gm01 전체 기능 headed 투어 (천천히)
 * DQPM_HEADED=1 DQPM_SLOW_MO=700 DQPM_STEP_MS=1500 node scripts/probe-gm01-headed-full.mjs
 */
import { chromium, expect } from '@playwright/test';
import { writeFileSync } from 'fs';

const strBase = process.env.DQPM_BASE || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const strUser = process.env.DQPM_USER || 'gm01';
const strPass = process.env.DQPM_PASS || 'gm01';
const bHeaded = process.env.DQPM_HEADED === '1' || process.env.DQPM_HEADED === 'true';
const nSlowMo = Number(process.env.DQPM_SLOW_MO || 700);
const nStepMs = Number(process.env.DQPM_STEP_MS || 1500);

const arrReport = [];
const fnStep = async (page, strId, strDesc, fnAction) => {
  console.log(`[${strId}] ${strDesc}`);
  try {
    await fnAction();
    arrReport.push({ strId, strDesc, strStatus: 'ok' });
  } catch (err) {
    arrReport.push({ strId, strDesc, strStatus: 'fail', strError: err?.message || String(err) });
    await page.screenshot({ path: `scripts/probe-gm01-fail-${strId}.png`, fullPage: true });
    throw err;
  }
  await page.waitForTimeout(nStepMs);
};

const fnShot = async (page, strName) => {
  await page.screenshot({ path: `scripts/probe-gm01-${strName}.png`, fullPage: true });
};

const fnClickMenu = async (page, strLabel) => {
  const loc = page.locator('.ant-menu-title-content').filter({ hasText: strLabel });
  if (await loc.count()) await loc.first().click();
  else await page.getByRole('menuitem', { name: strLabel }).first().click();
};

const browser = await chromium.launch({ headless: !bHeaded, slowMo: bHeaded ? nSlowMo : 0 });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

try {
  await fnStep(page, 'A-02', '로그인', async () => {
    await page.goto(`${strBase}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('input').first().fill(strUser);
    await page.locator('input[type="password"]').first().fill(strPass);
    await page.getByRole('button', { name: /로그인/ }).click();
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 });
    await fnShot(page, '01-login-ok');
  });

  await fnStep(page, 'B-10', 'GM 메뉴 노출·숨김', async () => {
    const arrExpectVisible = ['대시보드', '프로덕트', '쿼리 템플릿', '나의 대시보드', '이벤트 생성'];
    const arrExpectHidden = ['사용자', '역할 권한', 'DB 접속 정보'];
    for (const s of arrExpectVisible) {
      const n = await page.locator('.ant-menu-title-content').filter({ hasText: s }).count();
      if (!n) throw new Error(`메뉴 없음: ${s}`);
    }
    for (const s of arrExpectHidden) {
      const n = await page.locator('.ant-menu-title-content').filter({ hasText: s }).count();
      if (n) throw new Error(`메뉴 있으면 안 됨: ${s}`);
    }
    await fnShot(page, '02-sidebar');
  });

  await fnStep(page, 'B-01', '대시보드', async () => {
    await fnClickMenu(page, '대시보드');
    await page.waitForURL((u) => u.pathname === '/' || u.pathname === '', { timeout: 10000 });
    await expect(page.getByText(/대시보드|프로덕트|이벤트/i).first()).toBeVisible({ timeout: 10000 });
    await fnShot(page, '03-dashboard');
  });

  await fnStep(page, 'B-02', '프로덕트', async () => {
    await fnClickMenu(page, '프로덕트');
    await expect(page).toHaveURL(/\/products/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: '프로덕트 관리' })).toBeVisible();
    await fnShot(page, '04-products');
  });

  await fnStep(page, 'C-01', '프로덕트 추가 모달', async () => {
    const btnAdd = page.getByRole('button', { name: /추가|등록/ }).first();
    if (await btnAdd.count()) {
      await btnAdd.click();
      await expect(page.locator('.ant-modal').first()).toBeVisible({ timeout: 8000 });
      await fnShot(page, '05-products-modal');
      await page.getByRole('button', { name: /취소|닫기/ }).first().click();
    }
  });

  await fnStep(page, 'B-03', '쿼리 템플릿', async () => {
    await fnClickMenu(page, '쿼리 템플릿');
    await expect(page).toHaveURL(/\/events/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: '쿼리 템플릿' })).toBeVisible();
    await fnShot(page, '06-events');
  });

  await fnStep(page, 'B-07', '나의 대시보드', async () => {
    await fnClickMenu(page, '나의 대시보드');
    await expect(page).toHaveURL(/\/my-dashboard/, { timeout: 10000 });
    await page.waitForSelector('.ant-table', { timeout: 15000 });
    await fnShot(page, '07-my-dashboard');
  });

  await fnStep(page, 'E-X1', '이벤트 상세 모달', async () => {
    const btnDetail = page.getByRole('button', { name: '상세' }).first();
    if (!(await btnDetail.count())) {
      arrReport.push({ strId: 'E-X1', strDesc: '상세 행 없음', strStatus: 'skip' });
      return;
    }
    await btnDetail.click();
    const modal = page.locator('.ant-modal').filter({ hasText: '이벤트 상세' });
    await expect(modal).toBeVisible({ timeout: 10000 });
    await fnShot(page, '08-detail-modal');
    const btnHist = modal.getByRole('button', { name: /진행 이력/ }).first();
    if (await btnHist.count()) await btnHist.click();
    await page.waitForTimeout(800);
    await fnShot(page, '09-detail-history');
    await modal.getByRole('button', { name: '닫기' }).click().catch(() => page.keyboard.press('Escape'));
  });

  await fnStep(page, 'E-GM', 'GM 액션 버튼 노출 확인', async () => {
    const arrGmButtons = ['컨펌 요청', 'QA 확인', 'LIVE 확인', 'QA 쿼리 실행 요청', 'LIVE 쿼리 실행 요청', '수정'];
    const arrFound = [];
    for (const str of arrGmButtons) {
      if ((await page.getByRole('button', { name: str }).count()) > 0) arrFound.push(str);
    }
    arrReport.push({ strId: 'E-GM-btns', strDesc: '노출된 GM 버튼', strStatus: 'info', arrFound });
    await fnShot(page, '10-gm-buttons');
  });

  await fnStep(page, 'B-08', '이벤트 생성 페이지', async () => {
    await fnClickMenu(page, '이벤트 생성');
    await expect(page).toHaveURL(/\/query/, { timeout: 10000 });
    await expect(page.getByText(/이벤트|템플릿|프로덕트/i).first()).toBeVisible({ timeout: 15000 });
    await fnShot(page, '11-query-page');
  });

  await fnStep(page, 'D-01', '이벤트 생성 — 템플릿 영역만 확인(제출 안 함)', async () => {
    const sel = page.locator('.ant-select').first();
    if (await sel.count()) await sel.click().catch(() => {});
    await page.waitForTimeout(500);
    await fnShot(page, '12-query-form');
  });

  await fnStep(page, 'A-04', '로그아웃', async () => {
    await page.getByText(strUser, { exact: false }).first().click().catch(async () => {
      await page.locator('.ant-layout-header').getByRole('img', { name: 'user' }).first().click();
    });
    await page.getByRole('menuitem', { name: '로그아웃' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    await fnShot(page, '13-logout');
  });

  const nOk = arrReport.filter((r) => r.strStatus === 'ok').length;
  const nFail = arrReport.filter((r) => r.strStatus === 'fail').length;
  const objSummary = { strUser, strBase, nOk, nFail, arrReport };
  console.log(JSON.stringify(objSummary, null, 2));
  writeFileSync('scripts/probe-gm01-headed-report.json', JSON.stringify(objSummary, null, 2));

  if (bHeaded) {
    console.log('[headed] 15초 후 종료 — scripts/probe-gm01-*.png');
    await page.waitForTimeout(15000);
  }
} catch (err) {
  console.error('PROBE_ABORT', err?.message || err);
  process.exitCode = 1;
  if (bHeaded) await page.waitForTimeout(8000).catch(() => {});
} finally {
  await browser.close();
}
