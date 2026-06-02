/**
 * 시맨틱·카테고리 색 — Ant token + preset (페이지 hex 제거용)
 * @see docs/CURSOR-UI-AUDIT.md 3단계
 */

import { cyan, geekblue, magenta, purple } from '@ant-design/colors';
import type { GlobalToken } from 'antd/es/theme/interface';
import type { CSSProperties } from 'react';

export type TSemanticKind =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'primary'
  | 'cyan'
  | 'purple'
  | 'magenta'
  | 'indigo';

export function fnSemanticColor(strKind: TSemanticKind, token: GlobalToken): string {
  switch (strKind) {
    case 'success':
      return String(token.colorSuccess);
    case 'warning':
      return String(token.colorWarning);
    case 'error':
      return String(token.colorError);
    case 'info':
      return String(token.colorInfo);
    case 'primary':
      return String(token.colorPrimary);
    case 'cyan':
      return cyan[5];
    case 'purple':
      return purple[5];
    case 'magenta':
      return magenta[5];
    case 'indigo':
      return geekblue[5];
    default:
      return String(token.colorPrimary);
  }
}

export function fnSemanticFilledButtonStyle(
  strKind: TSemanticKind,
  token: GlobalToken,
): CSSProperties {
  const strBg = fnSemanticColor(strKind, token);
  return {
    background: strBg,
    borderColor: strBg,
    color: '#fff',
  };
}

export function fnSemanticStatisticStyle(
  strKind: TSemanticKind,
  token: GlobalToken,
  nFontSize = 22,
): CSSProperties {
  return { color: fnSemanticColor(strKind, token), fontSize: nFontSize };
}

/** 대시보드 숫자 카드 아이콘 색 */
const MAP_DASHBOARD_CARD_SEMANTIC: Record<string, TSemanticKind> = {
  eventTemplate: 'success',
  instance: 'warning',
  service: 'magenta',
  dbConnection: 'cyan',
  user: 'purple',
  role: 'magenta',
  instanceInProgress: 'info',
  instanceCompleted: 'success',
  productTable: 'info',
};

export function fnDashboardCardSemanticColor(
  strCardId: string,
  token: GlobalToken,
  strPrimaryColor: string,
): string {
  if (strCardId === 'product') return strPrimaryColor;
  const strKind = MAP_DASHBOARD_CARD_SEMANTIC[strCardId];
  if (strKind) return fnSemanticColor(strKind, token);
  return fnSemanticColor('indigo', token);
}
