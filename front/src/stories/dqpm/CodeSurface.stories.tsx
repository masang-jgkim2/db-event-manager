import type { Meta, StoryObj } from '@storybook/react';
import { Input, theme, Typography } from 'antd';
import {
  fnCodeSurfaceStyle,
  fnSqlEditorReadonlyStyle,
  OBJ_SQL_EDITOR_SURFACE,
  STR_CODE_BLOCK_CLASS,
} from '../../styles/queryEditorTokens';
import { STR_FONT_MONO } from '../../styles/cursorSiteTokens';

const STR_SAMPLE_SQL = `SELECT u.id, u.name
FROM users u
WHERE u.status = 'active';`;

const CodeSurfacePanel = () => {
  const { token } = theme.useToken();

  return (
    <div style={{ maxWidth: 640 }}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 20 }}>
        앱과 동일 모듈: <code>queryEditorTokens.ts</code> — MyDashboard·EventPage·QueryPage·QueryEditDiffView
      </Typography.Paragraph>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, opacity: 0.7 }}>
          fnCodeSurfaceStyle (라이트 surface · Ant token)
        </div>
        <pre
          className={STR_CODE_BLOCK_CLASS}
          style={{
            ...fnCodeSurfaceStyle(token, 12, { padding: 12, margin: 0 }),
            whiteSpace: 'pre-wrap',
          }}
        >
          {STR_SAMPLE_SQL}
        </pre>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, opacity: 0.7 }}>
          fnSqlEditorReadonlyStyle (Query 생성 결과 다크 블록)
        </div>
        <pre
          className={STR_CODE_BLOCK_CLASS}
          style={{
            ...fnSqlEditorReadonlyStyle(13),
            padding: 12,
            margin: 0,
            whiteSpace: 'pre-wrap',
          }}
        >
          {STR_SAMPLE_SQL}
        </pre>
        <div style={{ fontSize: 11, opacity: 0.65, marginTop: 6, fontFamily: STR_FONT_MONO }}>
          bg {OBJ_SQL_EDITOR_SURFACE.strBackground} · fg {OBJ_SQL_EDITOR_SURFACE.strForeground}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, opacity: 0.7 }}>
          TextArea + fnCodeSurfaceStyle
        </div>
        <Input.TextArea
          className={STR_CODE_BLOCK_CLASS}
          rows={4}
          readOnly
          value={STR_SAMPLE_SQL}
          style={fnCodeSurfaceStyle(token, 12)}
        />
      </div>
    </div>
  );
};

const meta: Meta = {
  title: 'DQPM/CodeSurface',
  component: CodeSurfacePanel,
  parameters: { layout: 'padded' },
};

export default meta;
type TStory = StoryObj;

export const SqlBlocks: TStory = {
  render: () => <CodeSurfacePanel />,
};
