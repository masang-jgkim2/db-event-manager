/**
 * localhost vs QA /products 디자인 토큰 비교 (로그인 후)
 * node front/scripts/compare-ds-products.mjs
 */
import { chromium } from 'playwright';

const ARR_TARGETS = [
  { strLabel: 'local', strBase: 'http://localhost:5173' },
  { strLabel: 'qa', strBase: 'https://qa-db.masanggames.co.kr' },
];

const STR_USER = process.env.E2E_USER_ID || 'admin';
const STR_PASS = process.env.E2E_PASSWORD || 'admin123';

const fnCollectDs = () => {
  const elRoot = document.documentElement;
  const elBody = document.body;
  const csBody = getComputedStyle(elBody);
  const elTitle = document.querySelector('h1.dqpm-page-title');
  const elTable = document.querySelector('.dqpm-layout-content-panel .ant-table');
  const csTitle = elTitle ? getComputedStyle(elTitle) : null;
  const csTable = elTable ? getComputedStyle(elTable) : null;
  const elBtn = document.querySelector('.dqpm-layout-content-panel .ant-btn-primary');
  const csBtn = elBtn ? getComputedStyle(elBtn) : null;

  const fnCssVar = (strName) => getComputedStyle(elRoot).getPropertyValue(strName).trim();

  return {
    strUrl: location.href,
    strHtmlTheme: elRoot.getAttribute('data-dqpm-theme'),
    strHtmlShell: elRoot.getAttribute('data-dqpm-shell'),
    objCssVars: {
      '--dqpm-font-family': fnCssVar('--dqpm-font-family'),
      '--dqpm-font-size-body': fnCssVar('--dqpm-font-size-body'),
      '--dqpm-font-size-page-title': fnCssVar('--dqpm-font-size-page-title'),
    },
    objBody: {
      strFontFamily: csBody.fontFamily,
      strFontSize: csBody.fontSize,
      strLineHeight: csBody.lineHeight,
    },
    objTitle: csTitle
      ? { strFontFamily: csTitle.fontFamily, strFontSize: csTitle.fontSize, strFontWeight: csTitle.fontWeight }
      : null,
    objTable: csTable
      ? { strFontFamily: csTable.fontFamily, strFontSize: csTable.fontSize }
      : null,
    objBtn: csBtn
      ? { strFontFamily: csBtn.fontFamily, strFontSize: csBtn.fontSize }
      : null,
    bInterLoaded: document.fonts ? document.fonts.check('16px Inter') : null,
    bNotoLoaded: document.fonts ? document.fonts.check('16px "Noto Sans KR"') : null,
    arrFontLinks: [...document.querySelectorAll('link[href*="fonts.googleapis"]')].map((el) => el.href),
  };
};

const fnLoginAndCollect = async (page, strBase) => {
  await page.goto(`${strBase}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByPlaceholder(/아이디/).fill(STR_USER);
  await page.getByPlaceholder('비밀번호').fill(STR_PASS);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL((strUrl) => !strUrl.pathname.startsWith('/login'), { timeout: 30000 });
  await page.goto(`${strBase}/products`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('h1.dqpm-page-title').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return page.evaluate(fnCollectDs);
};

const browser = await chromium.launch({ headless: true });
const objResults = {};

for (const objTarget of ARR_TARGETS) {
  const page = await browser.newPage();
  try {
    objResults[objTarget.strLabel] = await fnLoginAndCollect(page, objTarget.strBase);
  } catch (err) {
    objResults[objTarget.strLabel] = { strError: String(err) };
  }
  await page.close();
}

await browser.close();

const objLocal = objResults.local;
const objQa = objResults.qa;

const fnDiff = (strKey, a, b) => {
  const strA = JSON.stringify(a);
  const strB = JSON.stringify(b);
  return strA === strB ? null : { [strKey]: { local: a, qa: b } };
};

const objDiff = {};
if (!objLocal?.strError && !objQa?.strError) {
  for (const strKey of [
    'strHtmlTheme',
    'strHtmlShell',
    'objCssVars',
    'objBody',
    'objTitle',
    'objTable',
    'objBtn',
    'bInterLoaded',
    'bNotoLoaded',
  ]) {
    const d = fnDiff(strKey, objLocal[strKey], objQa[strKey]);
    if (d) Object.assign(objDiff, d);
  }
}

console.log(JSON.stringify({ objResults, objDiff, bSame: Object.keys(objDiff).length === 0 }, null, 2));
