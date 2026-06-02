import type { Meta, StoryObj } from '@storybook/react';
import { Button, Space, theme } from 'antd';
import {
  fnSemanticColor,
  fnSemanticFilledButtonStyle,
  fnSemanticStatisticStyle,
  fnDashboardCardSemanticColor,
  type TSemanticKind,
} from '../../styles/semanticColors';
import { useDesignSystem } from '../../styles/DesignSystemContext';

const ARR_KINDS: TSemanticKind[] = [
  'success',
  'warning',
  'error',
  'info',
  'primary',
  'cyan',
  'purple',
  'magenta',
  'indigo',
];

const Swatch = ({ strLabel, strHex }: { strLabel: string; strHex: string }) => (
  <div style={{ minWidth: 120 }}>
    <div
      style={{
        height: 40,
        borderRadius: 8,
        background: strHex,
        border: '1px solid rgba(38,37,30,0.12)',
      }}
    />
    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>{strLabel}</div>
    <div style={{ fontSize: 11, opacity: 0.7 }}>{strHex}</div>
  </div>
);

const SemanticPanel = () => {
  const { token } = theme.useToken();
  const { bCursorSiteShell, objColor } = useDesignSystem();

  return (
    <div style={{ maxWidth: 720 }}>
      <p style={{ marginBottom: 16, opacity: 0.75 }}>
        Shell: <strong>{bCursorSiteShell ? 'cursor-site' : 'ide'}</strong> — Ant token + preset
        (`@ant-design/colors`)
      </p>
      <Space wrap size={16} style={{ marginBottom: 24 }}>
        {ARR_KINDS.map((strKind) => (
          <Swatch key={strKind} strLabel={strKind} strHex={fnSemanticColor(strKind, token)} />
        ))}
      </Space>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Filled buttons</div>
        <Space wrap>
          {(['warning', 'magenta', 'success', 'info'] as const).map((strKind) => (
            <Button key={strKind} size="small" style={fnSemanticFilledButtonStyle(strKind, token)}>
              {strKind}
            </Button>
          ))}
        </Space>
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Statistic valueStyle</div>
        <Space>
          <span style={fnSemanticStatisticStyle('warning', token)}>대기 12</span>
          <span style={fnSemanticStatisticStyle('info', token)}>진행 3</span>
          <span style={fnSemanticStatisticStyle('success', token)}>완료 99</span>
        </Space>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Dashboard card icons</div>
        <Space wrap>
          {['product', 'eventTemplate', 'instance', 'dbConnection', 'custom'].map((strId) => (
            <Swatch
              key={strId}
              strLabel={strId}
              strHex={fnDashboardCardSemanticColor(strId, token, objColor.strPrimary)}
            />
          ))}
        </Space>
      </div>
    </div>
  );
};

const meta: Meta = {
  title: 'DQPM/SemanticColors',
  component: SemanticPanel,
  parameters: { layout: 'padded' },
};

export default meta;
type TStory = StoryObj;

export const Palette: TStory = {
  render: () => <SemanticPanel />,
};
