import React from 'react';
import { Typography, Tag, Space } from 'antd';
import type { ICardLabelRow } from '../types/dashboardLayout';
import type { IEventInstance, TEventStatus } from '../types';
import {
  OBJ_STATUS_CONFIG,
  OBJ_DISPLAY_ENV_COLOR,
  fnGetDisplayEnv,
} from '../types';
import { fnRenderStatusIcon } from '../constants/statusIcons';
import { fnGetInstanceValueByPath } from '../utils/dashboardInstanceField';

const { Text } = Typography;

function fnIsTEventStatus(val: unknown): val is TEventStatus {
  return typeof val === 'string' && val in OBJ_STATUS_CONFIG;
}

function fnFormatDatetimeShort(val: unknown): string {
  if (val == null || val === '') return '';
  const dt = new Date(String(val));
  if (Number.isNaN(dt.getTime())) return String(val);
  return dt.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
}

function fnFormatDatetimeFull(val: unknown): string {
  if (val == null || val === '') return '';
  const dt = new Date(String(val));
  if (Number.isNaN(dt.getTime())) return String(val);
  return dt.toLocaleString('ko-KR');
}

interface IInstanceCardLabelRowsProps {
  objInstance: IEventInstance;
  arrRows: ICardLabelRow[];
  strCardInnerLayout?: 'stack' | 'grid';
  nInnerColumns?: number;
  strInnerGap?: string;
}

/** arrCardRows 스펙대로 라벨 ← 값 렌더 (카드 본문용) */
export function InstanceCardLabelRows({
  objInstance,
  arrRows,
  strCardInnerLayout = 'stack',
  nInnerColumns = 1,
  strInnerGap = '8px 16px',
}: IInstanceCardLabelRowsProps) {
  const fnCell = (row: ICardLabelRow, nIdx: number) => {
    const objRaw = fnGetInstanceValueByPath(objInstance, row.strFieldPath);
    const strEmpty = row.strEmpty ?? '-';
    let elValue: React.ReactNode;

    const strRender = row.strRender ?? 'text';
    if (objRaw == null || objRaw === '') {
      elValue = <span>{strEmpty}</span>;
    } else if (strRender === 'datetime_short') {
      elValue = <span>{fnFormatDatetimeShort(objRaw) || strEmpty}</span>;
    } else if (strRender === 'datetime_full') {
      elValue = <span>{fnFormatDatetimeFull(objRaw) || strEmpty}</span>;
    } else if (strRender === 'status_tag' && fnIsTEventStatus(objRaw)) {
      const strSt = objRaw;
      elValue = (
        <Space size={4}>
          {fnRenderStatusIcon(strSt, 12)}
          <Tag color={OBJ_STATUS_CONFIG[strSt].strColor}>{OBJ_STATUS_CONFIG[strSt].strLabel}</Tag>
        </Space>
      );
    } else if (strRender === 'env_tag' && fnIsTEventStatus(objRaw)) {
      const strEnv = fnGetDisplayEnv(objRaw);
      elValue = strEnv ? (
        <Tag color={OBJ_DISPLAY_ENV_COLOR[strEnv]}>{strEnv}</Tag>
      ) : (
        <span>{strEmpty}</span>
      );
    } else if (strRender === 'tag') {
      elValue = <Tag>{String(objRaw)}</Tag>;
    } else {
      elValue = <span>{String(objRaw)}</span>;
    }

    const strLabelCol = row.strLabelWidth ?? 'minmax(72px,32%)';
    const elRow = (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `${strLabelCol} 1fr`,
          gap: 8,
          alignItems: 'start',
        }}
      >
        <Text type="secondary">{row.strLabel}</Text>
        <div style={{ minWidth: 0 }}>{elValue}</div>
      </div>
    );

    const nCol = row.nGridColumn;
    const nSpan = row.nColSpan ?? 1;
    const nRow = row.nGridRow;
    const objOuterStyle: React.CSSProperties = {};
    if (strCardInnerLayout === 'grid' && nInnerColumns > 1) {
      if (nCol != null) {
        objOuterStyle.gridColumn = nSpan > 1 ? `${nCol} / span ${nSpan}` : `${nCol}`;
      }
      if (nRow != null) objOuterStyle.gridRow = nRow;
    }

    return (
      <div key={nIdx} style={objOuterStyle}>
        {elRow}
      </div>
    );
  };

  if (strCardInnerLayout === 'grid' && nInnerColumns > 1) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${nInnerColumns}, 1fr)`,
          gap: strInnerGap,
        }}
      >
        {arrRows.map((row, nIdx) => fnCell(row, nIdx))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {arrRows.map((row, nIdx) => fnCell(row, nIdx))}
    </div>
  );
}
