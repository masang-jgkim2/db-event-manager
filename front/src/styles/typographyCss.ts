import type { ITypographyRoles } from './typographyTokens';

/** html 루트 CSS 변수 — index.css·코드 블록에서 참조 */
export function fnApplyTypographyCssVars(obj: {
  strFontUi: string;
  strFontMono: string;
  objTypoRoles: ITypographyRoles;
}): void {
  const el = document.documentElement;
  const r = obj.objTypoRoles;

  el.style.setProperty('--dqpm-font-family', obj.strFontUi);
  el.style.setProperty('--dqpm-font-family-mono', obj.strFontMono);
  el.style.setProperty('--dqpm-font-size-body', `${r.bodyMd.nFontSize}px`);
  el.style.setProperty('--dqpm-font-size-body-sm', `${r.bodySm.nFontSize}px`);
  el.style.setProperty('--dqpm-font-size-caption', `${r.caption.nFontSize}px`);
  el.style.setProperty('--dqpm-font-size-page-title', `${r.pageTitle.nFontSize}px`);
  el.style.setProperty('--dqpm-line-height-body', String(r.bodyMd.nLineHeight));
}
