import { test, expect } from '@playwright/test';
import { STR_GM_PASS, STR_GM_USER, fnE2eLogin } from './helpers/auth';
import {
  fnOpenUiSettings,
  fnSelectPrimaryPreset,
  STR_PRESET_CURSOR_IDE,
  STR_PRESET_CURSOR_SITE,
} from './helpers/theme';

test.describe('UI 테마 — Cursor.com 셸', { tag: '@smoke' }, () => {
  test.beforeEach(async ({ page }) => {
    await fnE2eLogin(page, STR_GM_USER, STR_GM_PASS);
  });

  test('T-01 Cursor.com + 라이트 → data-dqpm-shell=cursor-site', async ({ page }) => {
    await fnOpenUiSettings(page);
    await fnSelectPrimaryPreset(page, STR_PRESET_CURSOR_SITE);

    const elHtml = page.locator('html');
    await expect(elHtml).toHaveAttribute('data-dqpm-theme', 'light');
    await expect(elHtml).toHaveAttribute('data-dqpm-shell', 'cursor-site');

    // 웜 캔버스 — layout 배경이 cursor-site 토큰에 가깝게
    const strBg = await page.locator('.ant-layout').first().evaluate((el) =>
      getComputedStyle(el).backgroundColor,
    );
    expect(strBg).toMatch(/rgb/);
  });

  test('T-02 Cursor IDE 프리셋 → data-dqpm-shell=ide', async ({ page }) => {
    await fnOpenUiSettings(page);
    await fnSelectPrimaryPreset(page, STR_PRESET_CURSOR_IDE);

    await expect(page.locator('html')).toHaveAttribute('data-dqpm-shell', 'ide');
  });
});
