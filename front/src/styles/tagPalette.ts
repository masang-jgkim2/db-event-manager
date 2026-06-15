/**
 * 포인트 컬러(primary) 10단계 팔레트로 Tag 색을 통일한다.
 * Ant preset(blue/orange 등) 대신 variant → hex 로 ConfigProvider primary와 연동.
 */

/** Tag 시맨틱 슬롯 — arrPalette 인덱스와 매핑 */
export type TTagVariant =
  | 'product'
  | 'service'
  | 'dbMysql'
  | 'dbMssql'
  | 'dbPostgresql'
  | 'tone0'
  | 'tone1'
  | 'tone2'
  | 'tone3'
  | 'tone4'
  | 'tone5'
  | 'tone6'
  | 'tone7'
  | 'tone8'
  | 'tone9'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'muted';

export type ITagPalette = Record<TTagVariant, string>;

/** Ant Design Tag preset → primary 팔레트 슬롯 (마이그레이션·기존 color 문자열) */
const OBJ_LEGACY_TAG_COLOR: Record<string, TTagVariant> = {
  default: 'muted',
  blue: 'tone4',
  geekblue: 'product',
  cyan: 'tone3',
  green: 'success',
  orange: 'tone6',
  gold: 'tone7',
  red: 'danger',
  magenta: 'tone8',
  volcano: 'tone9',
  purple: 'tone8',
  lime: 'tone3',
  processing: 'tone5',
  success: 'success',
  error: 'danger',
  warning: 'warning',
};

export function fnBuildTagPalette(arrP: string[], bDark: boolean): ITagPalette {
  return {
    product: arrP[5],
    service: arrP[4],
    dbMysql: arrP[3],
    dbMssql: arrP[6],
    dbPostgresql: arrP[7],
    tone0: arrP[0],
    tone1: arrP[1],
    tone2: arrP[2],
    tone3: arrP[3],
    tone4: arrP[4],
    tone5: arrP[5],
    tone6: arrP[6],
    tone7: arrP[7],
    tone8: arrP[8],
    tone9: arrP[9],
    success: arrP[4],
    warning: arrP[8],
    danger: arrP[9],
    info: arrP[5],
    muted: bDark ? 'rgba(255, 255, 255, 0.14)' : arrP[1],
  };
}

const SET_TAG_VARIANTS = new Set<string>([
  'product', 'service', 'dbMysql', 'dbMssql', 'dbPostgresql',
  'tone0', 'tone1', 'tone2', 'tone3', 'tone4', 'tone5', 'tone6', 'tone7', 'tone8', 'tone9',
  'success', 'warning', 'danger', 'info', 'muted',
]);

export function fnIsTagVariant(str: string): str is TTagVariant {
  return SET_TAG_VARIANTS.has(str);
}

/** variant·legacy preset·hex → Tag color hex */
export function fnResolveTagColor(
  objTag: ITagPalette,
  strColorOrVariant?: string | null,
): string | undefined {
  if (!strColorOrVariant) return undefined;
  if (fnIsTagVariant(strColorOrVariant)) {
    return objTag[strColorOrVariant];
  }
  const strLegacy = OBJ_LEGACY_TAG_COLOR[strColorOrVariant];
  if (strLegacy) {
    return objTag[strLegacy];
  }
  if (strColorOrVariant.startsWith('#') || strColorOrVariant.startsWith('rgb')) {
    return strColorOrVariant;
  }
  return undefined;
}
