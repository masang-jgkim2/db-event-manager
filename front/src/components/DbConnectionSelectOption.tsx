import { Select } from 'antd';
import type { IDbConnection } from '../types';
import { DqpmTag } from './DqpmTag';
import { fnFormatDbConnectionCountryPlatform } from '../utils/countryPlatformLabel';
import {
  fnResolveConnectionServiceAbbr,
  type TProductServiceLookup,
} from '../utils/dbConnectionScope';

type TProductLookup = TProductServiceLookup & { strName?: string };

const fnResolveServiceTag = (
  c: IDbConnection,
  arrProducts: readonly TProductLookup[],
): string => {
  const strSvcLabel = fnResolveConnectionServiceAbbr(c, arrProducts);
  if (strSvcLabel) return fnFormatDbConnectionCountryPlatform(strSvcLabel);
  if (c.nServiceId) return `#${c.nServiceId}`;
  return fnFormatDbConnectionCountryPlatform(undefined);
};

/** Select 검색용 한 줄 라벨 (화면 표시는 태그 버튼) */
export const fnFormatConnectionSelectLabel = (
  c: IDbConnection,
  arrProducts: readonly TProductLookup[],
): string => {
  const strService = fnResolveServiceTag(c, arrProducts);
  return `${strService} · ${c.strKind || 'GAME'} · ${c.strEnv.toUpperCase()} · ${c.strHost}:${c.nPort} / ${c.strDatabase}`;
};

/** 서비스 · 종류 · QA/LIVE · 엔드포인트 — 태그 버튼 한 줄 */
export const DbConnectionSelectTagRow = ({
  c,
  arrProducts,
}: {
  c: IDbConnection;
  arrProducts: readonly TProductLookup[];
}) => {
  const strService = fnResolveServiceTag(c, arrProducts);
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        flexWrap: 'nowrap',
        lineHeight: 1.4,
        maxWidth: '100%',
        overflow: 'hidden',
      }}
    >
      <DqpmTag tone="service" style={{ fontSize: 11, margin: 0, flexShrink: 0 }}>{strService}</DqpmTag>
      <DqpmTag color="blue" style={{ margin: 0, flexShrink: 0 }}>{c.strKind || 'GAME'}</DqpmTag>
      <DqpmTag
        tone={c.strEnv === 'qa' ? 'tone3' : 'danger'}
        style={{ fontSize: 11, margin: 0, flexShrink: 0 }}
      >
        {c.strEnv.toUpperCase()}
      </DqpmTag>
      <span
        style={{
          fontSize: 12,
          color: 'var(--ant-color-text-secondary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {c.strHost}:{c.nPort} / {c.strDatabase}
      </span>
    </div>
  );
};

/** DB 접속 Select 옵션 */
export const fnRenderConnectionSelectOption = (
  c: IDbConnection,
  arrProducts: readonly TProductLookup[],
) => (
  <Select.Option key={c.nId} value={c.nId} label={fnFormatConnectionSelectLabel(c, arrProducts)}>
    <DbConnectionSelectTagRow c={c} arrProducts={arrProducts} />
  </Select.Option>
);

/** QA/LIVE 연결 Select 공통 props — 닫힌 상태에도 태그 버튼 표시 */
export const OBJ_DB_CONNECTION_SELECT_PROPS = {
  style: { width: '100%' } as const,
  showSearch: true,
  optionFilterProp: 'label' as const,
};
