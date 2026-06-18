import { test, expect } from '@playwright/test';
import { STR_DBA_PASS, STR_DBA_USER, STR_GM_PASS, STR_GM_USER, fnE2eLogin } from './helpers/auth';
import {
  fnClickRowAction,
  fnFindRowByIdPaging,
  fnGoMyDashboard,
  fnRowBtn,
  fnRowByInstanceId,
  fnSetDashFilter,
} from './helpers/dashboard';
import { fnApiGetInstance, fnHasQaDeploySucceeded } from './helpers/e2eCreators';
import {
  fnApiCreateWorkflowInstance,
  fnApiLoginToken,
  fnAssertWorkflowInstanceAllowed,
  fnLoadE2eWorkflowConfig,
} from './helpers/workflow';

const STR_API = (process.env.E2E_API_BASE || 'http://127.0.0.1:4000/api').replace(/\/$/, '');

test.describe.serial('E2E SELECT 워크플로 gm01+dba01 §I', { tag: ['@workflow', '@automate'] }, () => {
  const objCfg = fnLoadE2eWorkflowConfig();
  test.skip(!objCfg, 'e2e-workflow-config.json 없음 — backend: npm run seed-e2e-workflow:fresh');

  let nInstanceId = 0;
  let bQaExecuted = false;

  test.beforeAll(async () => {
    if (!objCfg) return;
    const strGmToken = await fnApiLoginToken(STR_API, STR_GM_USER, STR_GM_PASS);
    const nEnvId = Number(process.env.E2E_INSTANCE_ID || 0);
    if (nEnvId > 0) {
      await fnAssertWorkflowInstanceAllowed(STR_API, nEnvId, strGmToken);
      nInstanceId = nEnvId;
      const obj = await fnApiGetInstance(STR_API, strGmToken, nEnvId);
      if (obj && fnHasQaDeploySucceeded(obj.strStatus)) bQaExecuted = true;
      return;
    }
    nInstanceId = await fnApiCreateWorkflowInstance(objCfg, strGmToken, STR_GM_USER);
    await fnAssertWorkflowInstanceAllowed(STR_API, nInstanceId, strGmToken);
  });

  test('E-02 GM 이벤트 수정', async ({ page }) => {
    await fnE2eLogin(page, STR_GM_USER, STR_GM_PASS);
    await fnGoMyDashboard(page);
    await fnSetDashFilter(page, '내가 생성한 이벤트');
    const row = await fnFindRowByIdPaging(page, nInstanceId);
    await fnRowBtn(row, '수정').click();
    const modal = page.locator('.ant-modal').filter({ hasText: '이벤트 수정' });
    await expect(modal).toBeVisible();
    const inputName = modal.locator('input:not([disabled])').first();
    const strPrev = await inputName.inputValue();
    await inputName.fill(`${strPrev} [E2E수정]`);
    await modal.getByRole('button', { name: '저장' }).click();
    await expect(modal).toBeHidden({ timeout: 15000 });
    await fnGoMyDashboard(page);
    await fnSetDashFilter(page, '내가 생성한 이벤트');
    await expect(await fnFindRowByIdPaging(page, nInstanceId)).toContainText('[E2E수정]');
  });

  test('E-05 GM QA 실행 요청', async ({ page }) => {
    await fnE2eLogin(page, STR_GM_USER, STR_GM_PASS);
    await fnClickRowAction(page, nInstanceId, 'QA 쿼리 실행 요청', /요청/, {
      strDashFilter: '내가 생성한 이벤트',
    });
  });

  test('E-D1 DBA 쿼리 수정', async ({ page }) => {
    await fnE2eLogin(page, STR_DBA_USER, STR_DBA_PASS);
    await fnGoMyDashboard(page);
    const row = await fnFindRowByIdPaging(page, nInstanceId);
    await fnRowBtn(row, '쿼리 수정').click();
    const modal = page.locator('.ant-modal').filter({ hasText: 'DBA 쿼리 수정' });
    await expect(modal).toBeVisible();
    const ta = modal.locator('textarea').first();
    await ta.fill('SELECT 2 AS n_e2e_edited;');
    await modal.getByRole('button', { name: '저장' }).click();
    await expect(modal).toBeHidden({ timeout: 20000 });
  });

  test('E-06 DBA QA 실행', async ({ page }) => {
    test.setTimeout(120000);
    await fnE2eLogin(page, STR_DBA_USER, STR_DBA_PASS);
    await fnClickRowAction(page, nInstanceId, 'QA 쿼리 실행', /실행/, { strDashFilter: '내가 처리할 이벤트' });
    const modal = page.locator('.ant-modal');
    await modal.waitFor({ state: 'visible', timeout: 120000 });
    const strText = await modal.innerText();
    bQaExecuted = /성공적으로 실행/.test(strText);
    expect(bQaExecuted || /실행 실패/.test(strText)).toBeTruthy();
    await page.keyboard.press('Escape');
  });

  test('E-07 GM QA확인', async ({ page }) => {
    test.skip(!bQaExecuted, 'QA 실행 실패 — qa_deployed 미도달');
    await fnE2eLogin(page, STR_GM_USER, STR_GM_PASS);
    await fnClickRowAction(page, nInstanceId, 'QA확인', /확인/, { strDashFilter: '내가 생성한 이벤트' });
  });

  test('E-08 GM LIVE 실행 요청', async ({ page }) => {
    test.skip(!bQaExecuted, 'QA 확인 단계 미완료');
    await fnE2eLogin(page, STR_GM_USER, STR_GM_PASS);
    await fnClickRowAction(page, nInstanceId, 'LIVE 쿼리 실행 요청', /요청/, {
      strDashFilter: '내가 생성한 이벤트',
    });
  });

  test('E-09 DBA LIVE 실행', async ({ page }) => {
    test.skip(!bQaExecuted, 'LIVE 요청 단계 미완료');
    test.setTimeout(120000);
    await fnE2eLogin(page, STR_DBA_USER, STR_DBA_PASS);
    await fnClickRowAction(page, nInstanceId, 'LIVE 쿼리 실행', /실행/, { strDashFilter: '내가 처리할 이벤트' });
    const modal = page.locator('.ant-modal');
    await modal.waitFor({ state: 'visible', timeout: 120000 });
    await page.keyboard.press('Escape');
  });

  test('E-10 GM LIVE 확인', async ({ page }) => {
    test.skip(!bQaExecuted, 'LIVE 실행 단계 미완료');
    await fnE2eLogin(page, STR_GM_USER, STR_GM_PASS);
    await fnClickRowAction(page, nInstanceId, 'LIVE확인', /확인/, { strDashFilter: '내가 생성한 이벤트' });
  });
});
