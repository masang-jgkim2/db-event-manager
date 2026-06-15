import type { Meta, StoryObj } from '@storybook/react';
import { theme } from 'antd';
import { useDesignSystem } from '../../styles/DesignSystemContext';
import {
  STR_CURSOR_SITE_ACCENT,
  STR_CURSOR_SITE_CANVAS,
  STR_CURSOR_SITE_INK,
  STR_CURSOR_SITE_BODY,
  OBJ_CURSOR_TIMELINE,
} from '../../styles/cursorSiteTokens';

const Swatch = ({ strLabel, strHex }: { strLabel: string; strHex: string }) => (
  <div style={{ minWidth: 140 }}>
    <div
      style={{
        height: 48,
        borderRadius: 8,
        background: strHex,
        border: '1px solid rgba(38,37,30,0.12)',
      }}
    />
    <div style={{ fontSize: 12, marginTop: 6, fontWeight: 600 }}>{strLabel}</div>
    <div style={{ fontSize: 11, opacity: 0.7 }}>{strHex}</div>
  </div>
);

const FoundationPanel = () => {
  const { token } = theme.useToken();
  const { objTag, bCursorSiteShell } = useDesignSystem();

  const arrSite = [
    { strLabel: 'canvas', strHex: STR_CURSOR_SITE_CANVAS },
    { strLabel: 'ink', strHex: STR_CURSOR_SITE_INK },
    { strLabel: 'body', strHex: STR_CURSOR_SITE_BODY },
    { strLabel: 'accent', strHex: STR_CURSOR_SITE_ACCENT },
  ];

  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        Shell: <strong>{bCursorSiteShell ? 'cursor-site' : 'ide'}</strong>
        {' · '}
        Toolbar에서 Theme / Point를 바꿔 보세요.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        {arrSite.map((s) => (
          <Swatch key={s.strLabel} strLabel={s.strLabel} strHex={s.strHex} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <Swatch strLabel="colorBgLayout" strHex={String(token.colorBgLayout)} />
        <Swatch strLabel="colorPrimary" strHex={String(token.colorPrimary)} />
        <Swatch strLabel="colorText" strHex={String(token.colorText)} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {Object.entries(OBJ_CURSOR_TIMELINE).map(([strKey, strHex]) => (
          <Swatch key={strKey} strLabel={`timeline-${strKey}`} strHex={strHex} />
        ))}
      </div>
      <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {(['product', 'service', 'tone5', 'success', 'danger'] as const).map((tone) => (
          <Swatch key={tone} strLabel={`tag-${tone}`} strHex={objTag[tone]} />
        ))}
      </div>
    </div>
  );
};

const meta = {
  title: 'DQPM/Foundation',
  component: FoundationPanel,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof FoundationPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Colors: Story = {
  render: () => <FoundationPanel />,
};
