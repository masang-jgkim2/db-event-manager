import type { CSSProperties, ReactNode } from 'react';
import { Row, Col, Input, Select, Typography } from 'antd';
import type { TInputFormat } from '../types';
import { ARR_INPUT_FORMATS } from '../types';
import { STR_CODE_BLOCK_CLASS } from '../styles/queryEditorTokens';

const { Text } = Typography;

export type TQuerySetSlotRowItem = {
  strInputId: string;
  strInputFormat: TInputFormat;
};

export type TQuerySetInputSlotRowsProps = {
  arrSlots: TQuerySetSlotRowItem[];
  /** 3열 헤더 — «기본값 (선택)» / «미리보기 입력값 (저장 안 함)» / «입력값» */
  strThirdColumnLabel: string;
  objSqlFieldStyle?: CSSProperties;
  /** DBA 다중 슬롯 — «수정» 모달 안내 */
  strMultiSlotHint?: string;
  /** DBA 단일 슬롯 — ID/형식 편집 */
  bIdFormatEditable?: boolean;
  /** DBA 다중 슬롯 — 슬롯별 입력 형식만 편집 (ID는 «수정» 모달) */
  bFormatEditable?: boolean;
  strEditableInputId?: string;
  strEditableInputFormat?: TInputFormat;
  fnOnEditableInputIdChange?: (str: string) => void;
  fnOnEditableInputFormatChange?: (str: TInputFormat) => void;
  fnOnSlotFormatChange?: (nSlotIdx: number, strFormat: TInputFormat) => void;
  fnRenderValueCell: (objSlot: TQuerySetSlotRowItem, nSlotIdx: number) => ReactNode;
};

/** 쿼리 세트 입력 슬롯 — 입력 ID | 입력 형식 | 값 (6+6+12) 공통 레이아웃 */
export const QuerySetInputSlotRows = ({
  arrSlots,
  strThirdColumnLabel,
  objSqlFieldStyle,
  strMultiSlotHint,
  bIdFormatEditable = false,
  bFormatEditable = false,
  strEditableInputId = 'items',
  strEditableInputFormat = 'item_number',
  fnOnEditableInputIdChange,
  fnOnEditableInputFormatChange,
  fnOnSlotFormatChange,
  fnRenderValueCell,
}: TQuerySetInputSlotRowsProps) => {
  const objSelectStyle: CSSProperties = { width: '100%', ...(objSqlFieldStyle ?? {}) };
  const arrActive = arrSlots.filter((s) => s.strInputFormat !== 'none');
  if (arrActive.length === 0) {
    return (
      <Text type="secondary" style={{ fontSize: 12 }}>
        이 세트는 입력 슬롯 없음
      </Text>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {strMultiSlotHint && !bIdFormatEditable ? (
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
          {strMultiSlotHint}
        </Text>
      ) : null}
      <Row gutter={12} style={{ marginBottom: 4 }}>
        <Col span={6}>
          <Text type="secondary" style={{ fontSize: 12 }}>입력 ID</Text>
        </Col>
        <Col span={6}>
          <Text type="secondary" style={{ fontSize: 12 }}>입력 형식</Text>
        </Col>
        <Col span={12}>
          <Text type="secondary" style={{ fontSize: 12 }}>{strThirdColumnLabel}</Text>
        </Col>
      </Row>
      {arrSlots.map((objSlot, nSlotIdx) => {
        const bIdEditable = Boolean(bIdFormatEditable && nSlotIdx === 0);
        const bFormatEditableHere = bIdEditable || bFormatEditable;
        return (
          <Row
            gutter={12}
            key={objSlot.strInputId}
            align="middle"
            style={{ marginBottom: nSlotIdx < arrSlots.length - 1 ? 10 : 0 }}
          >
            <Col span={6}>
              {bIdEditable ? (
                <Input
                  className={STR_CODE_BLOCK_CLASS}
                  value={strEditableInputId}
                  onChange={(e) => fnOnEditableInputIdChange?.(e.target.value)}
                  placeholder="items"
                  style={objSqlFieldStyle}
                />
              ) : (
                <Input
                  className={STR_CODE_BLOCK_CLASS}
                  value={objSlot.strInputId}
                  disabled
                  style={objSqlFieldStyle}
                />
              )}
            </Col>
            <Col span={6}>
              {bFormatEditableHere ? (
                <Select
                  className={STR_CODE_BLOCK_CLASS}
                  style={objSelectStyle}
                  value={bIdEditable ? strEditableInputFormat : objSlot.strInputFormat}
                  onChange={(str) => {
                    if (bIdEditable) {
                      fnOnEditableInputFormatChange?.(str as TInputFormat);
                    } else {
                      fnOnSlotFormatChange?.(nSlotIdx, str as TInputFormat);
                    }
                  }}
                  options={ARR_INPUT_FORMATS.map((o) => ({ value: o.value, label: o.label }))}
                />
              ) : (
                <Select
                  className={STR_CODE_BLOCK_CLASS}
                  style={objSelectStyle}
                  value={objSlot.strInputFormat}
                  disabled
                  options={ARR_INPUT_FORMATS.map((o) => ({ value: o.value, label: o.label }))}
                />
              )}
            </Col>
            <Col span={12}>
              {objSlot.strInputFormat === 'none' ? (
                <Text type="secondary" style={{ fontSize: 12, lineHeight: '32px' }}>—</Text>
              ) : (
                fnRenderValueCell(objSlot, nSlotIdx)
              )}
            </Col>
          </Row>
        );
      })}
    </div>
  );
};
