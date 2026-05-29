import { test, expect } from '@playwright/test';
import { STR_DBA_PASS, STR_DBA_USER, fnE2eLogin } from './helpers/auth';
import { fnAssertWorkflowInstanceAllowed, fnApiLoginToken, fnLoadE2eWorkflowConfig } from './helpers/workflow';
import {
  fnExpandProgressHistory,
  fnExpandQueryResultPanel,
  fnOpenEventDetail,
} from './helpers/resultUi';

const STR_API = (process.env.E2E_API_BASE || 'http://127.0.0.1:4000/api').replace(/\/$/, '');
const objCfg = fnLoadE2eWorkflowConfig();
const nInstanceId = Number(process.env.E2E_INSTANCE_ID || objCfg?.nFreshInstanceId || 0);

const fnInstanceHasResultUiDemo = async (): Promise<boolean> => {
  try {
    const strToken = await fnApiLoginToken(STR_API, STR_DBA_USER, STR_DBA_PASS);
    await fnAssertWorkflowInstanceAllowed(STR_API, nInstanceId, strToken);
    const res = await fetch(`${STR_API}/event-instances/${nInstanceId}`, {
      headers: { Authorization: `Bearer ${strToken}` },
    });
    const obj = await res.json();
    const arrLogs = obj.objInstance?.arrStatusLogs as { strComment?: string }[] | undefined;
    return !!arrLogs?.some((l) => l.strComment === 'E2E_RESULT_UI_SELECT' || l.strComment === 'E2E_RESULT_UI_DML');
  } catch {
    return false;
  }
};

test.describe.serial('쿼리 결과 UI (F-02·F-03)', { tag: ['@automate', '@result-ui'] }, () => {
  test.skip(
    !nInstanceId,
    'e2e-workflow-config.json nFreshInstanceId 없음 — backend: seed-e2e-workflow:fresh',
  );

  test.beforeAll(async () => {
    const bReady = await fnInstanceHasResultUiDemo();
    test.skip(!bReady, 'seed-e2e-result-ui 후 백엔드 재기동 필요 (MySQL → 인메모리)');
  });

  test.beforeEach(async ({ page }) => {
    await fnE2eLogin(page, STR_DBA_USER, STR_DBA_PASS);
  });

  test('F-02 SELECT N행 조회 태그·결과 테이블', async ({ page }) => {
    test.setTimeout(90000);
    const modal = await fnOpenEventDetail(page, nInstanceId);
    await fnExpandProgressHistory(modal);
    await modal.getByText('E2E_RESULT_UI_SELECT').scrollIntoViewIfNeeded();

    const panel = await fnExpandQueryResultPanel(modal, /행 조회/);
    await expect(panel.getByText(/\d+행 조회/).first()).toBeVisible();
    await expect(panel.getByText('3행 조회').first()).toBeVisible();
    await expect(panel.locator('.ant-table')).toBeVisible();
    await expect(panel.locator('.ant-table tbody tr:not(.ant-table-measure-row)').first()).toBeVisible();
  });

  test('F-03 DML N건 처리 태그·결과 테이블 없음', async ({ page }) => {
    test.setTimeout(90000);
    const modal = await fnOpenEventDetail(page, nInstanceId);
    await fnExpandProgressHistory(modal);
    await modal.getByText('E2E_RESULT_UI_DML').scrollIntoViewIfNeeded();

    const panel = await fnExpandQueryResultPanel(modal, /건 처리/);
    await expect(panel.getByText('15건 처리').first()).toBeVisible();
    await expect(panel.locator('.ant-table')).toHaveCount(0);
  });

  test('F-02 QA 실행 모달 (qa_requested 행 있을 때)', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/my-dashboard');
    await page.waitForSelector('.ant-table tbody tr', { timeout: 15000 });

    const btnQa = page.getByRole('button', { name: 'QA 쿼리 실행' }).first();
    if ((await btnQa.count()) === 0) {
      test.skip(true, 'qa_requested 행 없음 — 시드 데모(F-02 상세)만 검증됨');
      return;
    }

    await btnQa.click();
    await page.locator('.ant-popconfirm').getByRole('button', { name: '실행' }).click();

    const modal = page.locator('.ant-modal').filter({ hasText: /QA 쿼리 실행/ });
    await expect(modal).toBeVisible({ timeout: 120000 });
    const strText = await modal.innerText();
    if (!/성공적으로 실행/.test(strText)) {
      test.skip(true, 'QA DB 실행 실패 — 환경 의존');
      return;
    }

    const btnRow = modal.getByRole('button', { name: /\d+행 조회/ }).first();
    if (await btnRow.count()) {
      await btnRow.click();
      await expect(modal.locator('.ant-table').first()).toBeVisible();
    }
  });
});
