/**
 * Generative UI — 서버/LLM이 내리는 UI 블록 스펙 (Discriminated union).
 * 렌더러는 이 타입만 받고, strType 화이트리스트로 AntD 컴포넌트에 매핑한다.
 */

export interface IBlockBase {
  strBlockId: string;
}

/** 숫자·지표 한 덩어리 */
export interface IBlockStatistic extends IBlockBase {
  strType: 'statistic';
  strTitle: string;
  strValue: string;
  strSuffix?: string;
}

/** 열 정의 + 행(셀은 원시값만 — HTML 금지) */
export interface IBlockTable extends IBlockBase {
  strType: 'table';
  strTitle?: string;
  arrColumns: { strKey: string; strTitle: string }[];
  arrRows: Record<string, string | number | boolean | null>[];
}

export type TAlertLevel = 'info' | 'success' | 'warning' | 'error';

export interface IBlockAlert extends IBlockBase {
  strType: 'alert';
  strMessage: string;
  strLevel?: TAlertLevel;
}

/** 마크다운 파서 없이 안전하게 — 줄바꿈만 유지(신뢰 소스에서만 사용) */
export interface IBlockTextPlain extends IBlockBase {
  strType: 'text_plain';
  strTitle?: string;
  strBody: string;
}

export type TUiBlock = IBlockStatistic | IBlockTable | IBlockAlert | IBlockTextPlain;

/** 한 화면(또는 카드 내부)에 여러 블록 */
export interface IUiSpec {
  strSchemaVersion: '1';
  arrBlocks: TUiBlock[];
}
