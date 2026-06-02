import type { Page } from '@playwright/test';

/** 헤더 UI 설정 드로어 */
export async function fnOpenUiSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'UI 설정' }).click();
  await page.getByText('포인트 컬러').waitFor({ state: 'visible' });
}

/** 포인트 컬러 프리셋 (라벨 텍스트로 선택) */
export async function fnSelectPrimaryPreset(page: Page, strLabel: string): Promise<void> {
  await page.locator('button').filter({ hasText: strLabel }).first().click();
}

export const STR_PRESET_CURSOR_SITE = 'Cursor.com';
export const STR_PRESET_CURSOR_IDE = 'Cursor IDE';
