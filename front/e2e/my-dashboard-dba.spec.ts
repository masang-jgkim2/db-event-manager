import { test, expect } from '@playwright/test';
import { STR_DBA_PASS, STR_DBA_USER, fnE2eLogin } from './helpers/auth';

test.describe('나의 대시보드 (DBA)', () => {
  test.beforeEach(async ({ page }) => {
    await fnE2eLogin(page, STR_DBA_USER, STR_DBA_PASS);
  });

  test('B-07 나의 대시보드 목록 로드', { tag: ['@automate', '@smoke'] }, async ({ page }) => {
    const menu = page.getByRole('menuitem', { name: '나의 대시보드' });
    if (await menu.count()) await menu.first().click();
    else await page.goto('/my-dashboard');
    await expect(page).toHaveURL('/my-dashboard');
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/전체|내 처리 대기/i).first()).toBeVisible();
  });

  test('E-X1 상세 모달 열기', { tag: ['@automate', '@smoke'] }, async ({ page }) => {
    await page.goto('/my-dashboard');
    await page.waitForSelector('.ant-table tbody tr', { timeout: 15000 });

    const btnDetail = page.getByRole('button', { name: '상세' }).first();
    await expect(btnDetail).toBeVisible();
    await btnDetail.click();

    const modal = page.locator('.ant-modal').filter({ hasText: '이벤트 상세' });
    await expect(modal).toBeVisible();
    await expect(modal.getByText('진행 이력')).toBeVisible();
  });

  test('F-04 QA 실행 모달까지 (DB 결과는 환경 의존)', {
    tag: ['@automate', '@workflow'],
  }, async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('/my-dashboard');
    await page.waitForSelector('.ant-table tbody tr', { timeout: 15000 });

    const btnQa = page.getByRole('button', { name: 'QA 쿼리 실행' }).first();
    if ((await btnQa.count()) === 0) {
      test.skip(true, 'qa_requested 상태 행 없음 — 체크리스트 §I 수동 진행');
      return;
    }

    await btnQa.click();
    await page.locator('.ant-popconfirm').getByRole('button', { name: '실행' }).click();

    const modal = page.locator('.ant-modal').filter({ hasText: /QA 쿼리 실행/ });
    await expect(modal).toBeVisible({ timeout: 120000 });

    const strText = await modal.innerText();
    const bSuccess = /성공적으로 실행/.test(strText);
    const bFail = /실행 실패/.test(strText);
    expect(bSuccess || bFail).toBeTruthy();

    if (bSuccess) {
      await expect(modal.getByText(/쿼리별 결과|실행 요약/).first()).toBeVisible();
    }
  });
});
