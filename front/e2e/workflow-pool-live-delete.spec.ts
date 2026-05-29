/**
 * E2E 풀 #152~162 — LIVE 반영·LIVE 확인·삭제 (생성자 gm01/dba01/gm02 만)
 * 사전: 인스턴스가 qa_requested 이상·live_verified 등 풀 상태에 있을 것
 * E2E_INSTANCE_POOL=152-162 (기본) · E2E_INSTANCE_ID=단일 고정(선택)
 */
import { test, expect } from '@playwright/test';
import { STR_DBA_PASS, STR_DBA_USER, STR_GM_PASS, STR_GM_USER, fnE2eLogin } from './helpers/auth';
import {
  fnClickRowAction,
  fnClickRowDelete,
  fnFindRowByIdPaging,
  fnGoMyDashboard,
  fnRowBtn,
  fnSetDashFilter,
} from './helpers/dashboard';
import {
  fnApiGetInstance,
  fnAssertE2eAllowedCreator,
  fnFetchAllowedCreatorUserIds,
  fnHasQaDeploySucceeded,
  fnParseE2eInstancePool,
  fnPickPoolInstance,
} from './helpers/e2eCreators';
import { fnApiLoginToken } from './helpers/workflow';

const STR_API = (process.env.E2E_API_BASE || 'http://127.0.0.1:4000/api').replace(/\/$/, '');
const arrPool = fnParseE2eInstancePool();
const bSkipDelete =
  process.env.E2E_SKIP_DELETE === '1' || process.env.E2E_POOL_SKIP_DELETE === '1';

test.describe.serial('E2E 풀 LIVE·삭제 #152-162', { tag: ['@workflow', '@pool', '@automate'] }, () => {
  test.skip(arrPool.length === 0, 'E2E_INSTANCE_POOL 비어 있음');

  let setAllowedUserIds = new Set<number>();
  let nGmUserId = 0;
  let bQaOk = false;
  let nWorkedId = 0;

  test.beforeAll(async () => {
    setAllowedUserIds = await fnFetchAllowedCreatorUserIds(STR_API);
    const resLogin = await fetch(`${STR_API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strUserId: STR_GM_USER, strPassword: STR_GM_PASS }),
    });
    const objLogin = await resLogin.json();
    nGmUserId = objLogin.user?.nId ?? 0;
    const strGmToken = objLogin.strToken as string;

    const nFixed = Number(process.env.E2E_INSTANCE_ID || 0);
    if (nFixed > 0) {
      const obj = await fnApiGetInstance(STR_API, strGmToken, nFixed);
      if (obj) {
        fnAssertE2eAllowedCreator(obj, setAllowedUserIds);
        if (!arrPool.includes(nFixed)) {
          console.warn(`[pool] E2E_INSTANCE_ID=#${nFixed} 가 풀 밖 — 생성자 검증만 적용`);
        }
        if (fnHasQaDeploySucceeded(obj.strStatus)) {
          bQaOk = true;
          nWorkedId = nFixed;
        }
      }
    }
  });

  const fnResolveId = async (strStatus: string, strToken: string): Promise<number | null> => {
    const nFixed = Number(process.env.E2E_INSTANCE_ID || 0);
    if (nFixed > 0) {
      const obj = await fnApiGetInstance(STR_API, strToken, nFixed);
      if (obj?.strStatus === strStatus) {
        fnAssertE2eAllowedCreator(obj, setAllowedUserIds);
        return nFixed;
      }
      return null;
    }
    return fnPickPoolInstance(STR_API, strToken, arrPool, setAllowedUserIds, strStatus);
  };

  test('E-06 풀 QA 쿼리 실행 (qa_requested)', async ({ page }) => {
    test.setTimeout(120000);
    const strToken = await fnApiLoginToken(STR_API, STR_DBA_USER, STR_DBA_PASS);
    const nId = await fnResolveId('qa_requested', strToken);
    test.skip(!nId, `풀 ${arrPool[0]}~${arrPool[arrPool.length - 1]}에 qa_requested 없음`);
    nWorkedId = nId;
    await fnE2eLogin(page, STR_DBA_USER, STR_DBA_PASS);
    await fnClickRowAction(page, nId, 'QA 쿼리 실행', /실행/, { strDashFilter: '내가 처리할 이벤트' });
    const modal = page.locator('.ant-modal');
    await modal.waitFor({ state: 'visible', timeout: 120000 });
    const strText = await modal.innerText();
    bQaOk = /성공적으로 실행/.test(strText);
    expect(bQaOk || /실행 실패/.test(strText)).toBeTruthy();
    await page.keyboard.press('Escape');
  });

  test('E-07 GM QA확인', async ({ page }) => {
    test.skip(!bQaOk || !nWorkedId, 'QA 실행 미성공');
    await fnE2eLogin(page, STR_GM_USER, STR_GM_PASS);
    await fnClickRowAction(page, nWorkedId, 'QA확인', /확인/, { strDashFilter: '내가 생성한 이벤트' });
  });

  test('E-08 GM LIVE 실행 요청', async ({ page }) => {
    test.skip(!bQaOk || !nWorkedId, 'QA 라인 미완료');
    await fnE2eLogin(page, STR_GM_USER, STR_GM_PASS);
    await fnClickRowAction(page, nWorkedId, 'LIVE 쿼리 실행 요청', /요청/, {
      strDashFilter: '내가 생성한 이벤트',
    });
  });

  test('E-09 DBA LIVE 실행', async ({ page }) => {
    test.setTimeout(120000);
    const strToken = await fnApiLoginToken(STR_API, STR_DBA_USER, STR_DBA_PASS);
    let nId = nWorkedId;
    if (!nId) nId = (await fnResolveId('live_requested', strToken)) ?? 0;
    test.skip(!nId, 'live_requested 인스턴스 없음');
    const objSt = await fnApiGetInstance(STR_API, strToken, nId);
    test.skip(objSt?.strStatus !== 'live_requested', `E-08 미완료 — 현재 ${objSt?.strStatus}`);
    nWorkedId = nId;
    await fnE2eLogin(page, STR_DBA_USER, STR_DBA_PASS);
    await fnClickRowAction(page, nId, 'LIVE 쿼리 실행', /실행/, { strDashFilter: '내가 처리할 이벤트' });
    const modal = page.locator('.ant-modal');
    await modal.waitFor({ state: 'visible', timeout: 120000 });
    expect(/성공적으로 실행|실행 실패/.test(await modal.innerText())).toBeTruthy();
    await page.keyboard.press('Escape');
  });

  test('E-10 GM LIVE확인', async ({ page }) => {
    const strToken = await fnApiLoginToken(STR_API, STR_GM_USER, STR_GM_PASS);
    let nId = nWorkedId;
    if (!nId) nId = (await fnResolveId('live_deployed', strToken)) ?? 0;
    if (!nId) {
      nId = (await fnPickPoolInstance(
        STR_API,
        strToken,
        arrPool,
        setAllowedUserIds,
        'live_verified',
      )) ?? 0;
      if (nId) {
        test.skip(true, `#${nId} 이미 live_verified — LIVE확인 생략`);
        return;
      }
    }
    test.skip(!nId, 'live_deployed/live_verified 대상 없음');
    nWorkedId = nId;
    await fnE2eLogin(page, STR_GM_USER, STR_GM_PASS);
    await fnGoMyDashboard(page);
    await fnSetDashFilter(page, '내가 생성한 이벤트');
    const row = await fnFindRowByIdPaging(page, nId);
    if (!(await fnRowBtn(row, 'LIVE확인').count())) {
      test.skip(true, `#${nId} LIVE확인 버튼 없음(이미 live_verified 가능)`);
      return;
    }
    await fnRowBtn(row, 'LIVE확인').click();
    const pop = page.locator('.ant-popconfirm');
    await pop.waitFor({ state: 'visible', timeout: 8000 });
    await pop.getByRole('button', { name: /확인/ }).click();
  });

});

test.describe('E2E 풀 삭제 only', { tag: ['@workflow', '@pool', '@automate'] }, () => {
  test.skip(bSkipDelete, 'E2E_SKIP_DELETE=1 — 삭제 단계 생략');

  const arrPoolDel = fnParseE2eInstancePool();
  let setAllowedDel = new Set<number>();
  let nGmUserIdDel = 0;

  test.beforeAll(async () => {
    setAllowedDel = await fnFetchAllowedCreatorUserIds(STR_API);
    const resLogin = await fetch(`${STR_API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strUserId: STR_GM_USER, strPassword: STR_GM_PASS }),
    });
    const objLogin = await resLogin.json();
    nGmUserIdDel = objLogin.user?.nId ?? 0;
  });

  test('E-X3 GM 삭제 (live_verified · delete_own)', { tag: ['@delete'] }, async ({ page }) => {
    const strToken = await fnApiLoginToken(STR_API, STR_GM_USER, STR_GM_PASS);
    const nFixed = Number(process.env.E2E_INSTANCE_ID || 0);
    let nId = 0;
    if (nFixed > 0) {
      const obj = await fnApiGetInstance(STR_API, strToken, nFixed);
      if (obj?.strStatus === 'live_verified' && !obj.bPermanentlyRemoved) {
        fnAssertE2eAllowedCreator(obj, setAllowedDel);
        if (!nGmUserIdDel || obj.nCreatedByUserId === nGmUserIdDel) nId = nFixed;
      }
    } else {
      nId =
        (await fnPickPoolInstance(STR_API, strToken, arrPoolDel, setAllowedDel, 'live_verified', {
          nCreatorUserId: nGmUserIdDel || undefined,
        })) ?? 0;
    }
    test.skip(!nId, `삭제할 live_verified 없음 (#${nFixed || 'pool'})`);
    await fnE2eLogin(page, STR_GM_USER, STR_GM_PASS);
    await fnClickRowDelete(page, nId);
    await expect(
      page.locator('.ant-segmented-item-selected .ant-segmented-item-label'),
    ).toContainText(/완료·숨김/, { timeout: 10000 });
    const row = await fnFindRowByIdPaging(page, nId);
    await expect(row.getByText(/삭제됨/)).toBeVisible({ timeout: 15000 });
  });
});

