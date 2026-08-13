import { Typography, theme as antdTheme } from 'antd';
import type { IQueryEditLog } from '../types';
import { fnDiffChangedLinesOnly } from '../utils/textLineDiff';
import { fnCoalesceSetChangeDeleteAddPairs } from '../utils/queryEditSetChanges';
import { fnCodeSurfaceStyle, STR_CODE_BLOCK_CLASS } from '../styles/queryEditorTokens';

const { Text } = Typography;

const QueryTextDiff = ({ strBefore, strAfter }: { strBefore: string; strAfter: string }) => {
  const { token } = antdTheme.useToken();
  const arrLines = fnDiffChangedLinesOnly(strBefore, strAfter);
  if (arrLines.length === 0) {
    return <Text type="secondary" style={{ fontSize: 11 }}>변경된 줄 없음</Text>;
  }

  return (
    <pre
      className={STR_CODE_BLOCK_CLASS}
      style={fnCodeSurfaceStyle(token, 11, {
        margin: 0,
        padding: 8,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        maxHeight: 280,
        overflow: 'auto',
      })}
    >
      {arrLines.map((line, nIdx) => {
        const nLineNo = line.strKind === 'removed' ? line.nLineNoBefore : line.nLineNoAfter;
        return (
          <span
            key={`${nIdx}-${line.strKind}-${nLineNo ?? 'x'}`}
            style={{
              display: 'block',
              background: line.strKind === 'removed' ? token.colorErrorBg : token.colorSuccessBg,
              textDecoration: line.strKind === 'removed' ? 'line-through' : undefined,
            }}
          >
            <span style={{ color: token.colorTextSecondary, userSelect: 'none', marginRight: 6 }}>
              {nLineNo != null ? `${nLineNo} ` : ''}
              {line.strKind === 'removed' ? '−' : '+'}
            </span>
            {line.strLine || ' '}
          </span>
        );
      })}
    </pre>
  );
};

type TQueryEditDiffViewProps = {
  objQueryEdit: IQueryEditLog;
};

const QueryEditDiffView = ({ objQueryEdit }: TQueryEditDiffViewProps) => {
  if (objQueryEdit.arrSetChanges?.length) {
    // 과거 삭제+추가 쪼개기 로그도 줄 단위 diff로 보이도록 합침
    const arrChanges = fnCoalesceSetChangeDeleteAddPairs(objQueryEdit.arrSetChanges);
    return (
      <>
        {arrChanges.map((chg, nMapIdx) => (
          <div key={`${chg.nSetIndex}-${nMapIdx}`} style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
              쿼리 세트 {chg.nSetIndex + 1}
            </Text>
            <QueryTextDiff strBefore={chg.strBefore} strAfter={chg.strAfter} />
          </div>
        ))}
      </>
    );
  }

  if (objQueryEdit.strBefore != null && objQueryEdit.strAfter != null) {
    return <QueryTextDiff strBefore={objQueryEdit.strBefore} strAfter={objQueryEdit.strAfter} />;
  }

  return null;
};

export default QueryEditDiffView;
