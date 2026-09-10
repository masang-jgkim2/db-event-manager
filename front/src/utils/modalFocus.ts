/**
 * 모달 첫 입력 포커스 유틸.
 * - Input: afterOpenChange 후 텍스트 포커스·커서
 * - Select: 지연 open + 트랩 close 무시 + selection-search-input 포커스(커서)
 */

export const N_MODAL_SELECT_OPEN_DELAY_MS = 150;
export const N_MODAL_SELECT_IGNORE_CLOSE_MS = 500;

/** 열린 Select의 검색 input에 포커스 — Input처럼 커서(캐럿) 표시 */
export const fnFocusOpenSelectSearch = (objScope?: ParentNode | null): void => {
  const objRoot = objScope ?? document;
  const objOpenSelect = objRoot.querySelector('.ant-select-open')
    ?? document.querySelector('.ant-select-open');
  if (!objOpenSelect) return;

  const objSearch =
    objOpenSelect.querySelector<HTMLInputElement>('input.ant-select-selection-search-input')
    ?? document.querySelector<HTMLInputElement>(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden) input.ant-select-selection-search-input, '
      + '.ant-select-dropdown:not(.ant-select-dropdown-hidden) input',
    );
  if (!objSearch) return;
  objSearch.focus({ preventScroll: true });
};

/** 모달 애니메이션·포커스 트랩 이후 Select 드롭다운 오픈 예약 */
export const fnScheduleModalSelectOpen = (
  fnSetOpen: (bOpen: boolean) => void,
  refIgnoreCloseUntilMs: { current: number },
  fnAfterOpen?: () => void,
): number => {
  refIgnoreCloseUntilMs.current = Date.now() + N_MODAL_SELECT_IGNORE_CLOSE_MS;
  return window.setTimeout(() => {
    fnSetOpen(true);
    // open 반영 후 search input 포커스 (커서)
    window.setTimeout(() => {
      fnFocusOpenSelectSearch();
      fnAfterOpen?.();
    }, 50);
  }, N_MODAL_SELECT_OPEN_DELAY_MS);
};

/** Select onDropdownVisibleChange — 오픈 직후 트랩에 의한 close는 무시 */
export const fnOnModalSelectVisibleChange = (
  bOpen: boolean,
  fnSetOpen: (bOpen: boolean) => void,
  refIgnoreCloseUntilMs: { current: number },
): void => {
  if (!bOpen && Date.now() < refIgnoreCloseUntilMs.current) return;
  fnSetOpen(bOpen);
  if (bOpen) {
    window.setTimeout(() => fnFocusOpenSelectSearch(), 0);
  }
};

/**
 * 모달 오픈 직후 텍스트 첫 입력에 포커스.
 * Select는 fnScheduleModalSelectOpen 사용.
 */
export const fnAfterModalOpenFocusFirst = (bOpen: boolean): void => {
  if (!bOpen) return;

  window.setTimeout(() => {
    const arrWraps = Array.from(document.querySelectorAll('.ant-modal-wrap'));
    const objWrap = [...arrWraps].reverse().find((el) => {
      const strDisplay = window.getComputedStyle(el).display;
      return strDisplay !== 'none';
    });
    if (!objWrap) return;
    const objBody = objWrap.querySelector('.ant-modal-body');
    if (!objBody) return;

    const fnFocusText = (objEl: HTMLInputElement | HTMLTextAreaElement): void => {
      objEl.focus({ preventScroll: true });
      try {
        objEl.select();
      } catch {
        /* ignore */
      }
    };

    const objMarked = objBody.querySelector<HTMLElement>('[data-dqpm-modal-focus="1"]');
    if (objMarked) {
      if (objMarked instanceof HTMLInputElement || objMarked instanceof HTMLTextAreaElement) {
        fnFocusText(objMarked);
        return;
      }
      const objInner = objMarked.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        'input:not([type="hidden"]):not(.ant-select-selection-search-input), textarea',
      );
      if (objInner) {
        fnFocusText(objInner);
        return;
      }
    }

    const objTextAutofocus = objBody.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      'input[autofocus]:not(.ant-select-selection-search-input):not([type="hidden"]), textarea[autofocus]',
    );
    if (objTextAutofocus) {
      fnFocusText(objTextAutofocus);
    }
  }, 150);
};
