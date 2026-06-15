import React, { useCallback, useMemo, useRef } from 'react';
import { theme as antdTheme } from 'antd';
import type { CSSProperties } from 'react';
import { STR_CODE_BLOCK_CLASS } from '../styles/queryEditorTokens';
import { STR_FONT_MONO } from '../styles/cursorSiteTokens';

const N_LINE_HEIGHT = 1.5;
const N_PAD_Y = 12;
const N_PAD_X = 12;
const N_GUTTER_PAD_X = 8;

type TSqlLineNumberAreaProps = {
  strValue: string;
  bReadOnly?: boolean;
  fnOnChange?: (strValue: string) => void;
  nMinRows?: number;
  nMaxRows?: number;
  nFontSize?: number;
  objStyle?: CSSProperties;
  strClassName?: string;
  strPlaceholder?: string;
};

const fnCountLines = (str: string): number => {
  if (!str) return 1;
  return str.replace(/\r\n/g, '\n').split('\n').length;
};

/** SQL textarea + 왼쪽 줄 번호 gutter (읽기·편집 공용) */
const SqlLineNumberArea = ({
  strValue,
  bReadOnly = false,
  fnOnChange,
  nMinRows = 4,
  nMaxRows = 15,
  nFontSize = 12,
  objStyle,
  strClassName,
  strPlaceholder,
}: TSqlLineNumberAreaProps) => {
  const { token } = antdTheme.useToken();
  const refGutter = useRef<HTMLPreElement>(null);
  const refTa = useRef<HTMLTextAreaElement>(null);

  const nLines = useMemo(() => fnCountLines(strValue), [strValue]);
  const strGutter = useMemo(
    () => Array.from({ length: nLines }, (_, nIdx) => String(nIdx + 1)).join('\n'),
    [nLines],
  );

  const nLinePx = nFontSize * N_LINE_HEIGHT;
  const nMinHeight = nMinRows * nLinePx + N_PAD_Y * 2;
  const nMaxHeight = nMaxRows * nLinePx + N_PAD_Y * 2;

  const fnOnScroll = useCallback(() => {
    if (refGutter.current && refTa.current) {
      refGutter.current.scrollTop = refTa.current.scrollTop;
    }
  }, []);

  const objSharedText: CSSProperties = {
    fontFamily: STR_FONT_MONO,
    fontSize: nFontSize,
    lineHeight: N_LINE_HEIGHT,
    margin: 0,
    padding: `${N_PAD_Y}px`,
  };

  return (
    <div
      className={`${STR_CODE_BLOCK_CLASS} ${strClassName ?? ''}`.trim()}
      style={{
        display: 'flex',
        overflow: 'hidden',
        fontFamily: STR_FONT_MONO,
        fontSize: nFontSize,
        background: token.colorFillTertiary,
        color: token.colorText,
        borderRadius: token.borderRadius,
        border: 'none',
        ...objStyle,
        padding: 0,
      }}
    >
      <pre
        ref={refGutter}
        aria-hidden
        className={STR_CODE_BLOCK_CLASS}
        style={{
          ...objSharedText,
          paddingLeft: N_GUTTER_PAD_X,
          paddingRight: N_GUTTER_PAD_X,
          textAlign: 'right',
          color: token.colorTextQuaternary,
          userSelect: 'none',
          overflow: 'hidden',
          flexShrink: 0,
          minWidth: `${String(nLines).length + 1}ch`,
          minHeight: nMinHeight,
          maxHeight: nMaxHeight,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillQuaternary,
        }}
      >
        {strGutter}
      </pre>
      <textarea
        ref={refTa}
        readOnly={bReadOnly}
        value={strValue}
        onChange={(e) => fnOnChange?.(e.target.value)}
        onScroll={fnOnScroll}
        placeholder={strPlaceholder}
        spellCheck={false}
        className={STR_CODE_BLOCK_CLASS}
        style={{
          ...objSharedText,
          paddingLeft: N_PAD_X,
          paddingRight: N_PAD_X,
          flex: 1,
          border: 'none',
          outline: 'none',
          resize: 'none',
          overflow: 'auto',
          background: 'transparent',
          color: token.colorText,
          minHeight: nMinHeight,
          maxHeight: nMaxHeight,
          width: '100%',
          cursor: bReadOnly ? 'default' : 'text',
        }}
      />
    </div>
  );
};

export default SqlLineNumberArea;
