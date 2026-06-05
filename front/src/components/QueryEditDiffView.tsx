import { Typography, theme as antdTheme } from 'antd';
import type { IQueryEditLog } from '../types';
import { fnDiffChangedLinesOnly } from '../utils/textLineDiff';
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
      {arrLines.map((line, nIdx) => (
        <span
          key={`${nIdx}-${line.strKind}`}
          style={{
            display: 'block',
            background: line.strKind === 'removed' ? token.colorErrorBg : token.colorSuccessBg,
            textDecoration: line.strKind === 'removed' ? 'line-through' : undefined,
          }}
        >
          <span style={{ color: token.colorTextSecondary, userSelect: 'none', marginRight: 6 }}>
            {line.strKind === 'removed' ? '−' : '+'}
          </span>
          {line.strLine || ' '}
        </span>
      ))}
    </pre>
  );
};

type TQueryEditDiffViewProps = {
  objQueryEdit: IQueryEditLog;
};

const QueryEditDiffView = ({ objQueryEdit }: TQueryEditDiffViewProps) => {
  if (objQueryEdit.arrSetChanges?.length) {
    return (
      <>
        {objQueryEdit.arrSetChanges.map((chg) => (
          <span key={chg.nSetIndex} style={{ display: 'block', marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>쿼리 세트 {chg.nSetIndex + 1}</Text>
            <QueryTextDiff strBefore={chg.strBefore} strAfter={chg.strAfter} />
          </span>
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
