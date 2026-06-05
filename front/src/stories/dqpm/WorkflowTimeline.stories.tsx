import type { Meta, StoryObj } from '@storybook/react';
import { Timeline, Typography } from 'antd';
import { OBJ_CURSOR_TIMELINE } from '../../styles/cursorSiteTokens';
import { fnStatusTimelineColor } from '../../styles/workflowTimelineColors';
import { OBJ_STATUS_CONFIG, type TEventStatus } from '../../types';

const ARR_TIMELINE_KEYS = ['thinking', 'grep', 'read', 'edit', 'done'] as const;

const ARR_STATUSES = Object.keys(OBJ_STATUS_CONFIG) as TEventStatus[];

const TimelinePalettePanel = () => (
  <div style={{ maxWidth: 720 }}>
    <Typography.Paragraph type="secondary" style={{ marginBottom: 20 }}>
      토큰: <code>OBJ_CURSOR_TIMELINE</code> · 매핑: <code>fnStatusTimelineColor</code> (MyDashboard Steps·이력
      Timeline)
    </Typography.Paragraph>

    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
      {ARR_TIMELINE_KEYS.map((strKey) => (
        <div key={strKey} style={{ minWidth: 100 }}>
          <div
            style={{
              height: 36,
              borderRadius: 8,
              background: OBJ_CURSOR_TIMELINE[strKey],
              border: '1px solid rgba(38,37,30,0.12)',
            }}
          />
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>{strKey}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>{OBJ_CURSOR_TIMELINE[strKey]}</div>
        </div>
      ))}
    </div>

    <Typography.Title level={5} style={{ marginTop: 0 }}>
      상태 → 파스텔 (앱과 동일 함수)
    </Typography.Title>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
      {ARR_STATUSES.map((strStatus) => {
        const strColor = fnStatusTimelineColor(strStatus);
        return (
          <div key={strStatus} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: strColor,
                flexShrink: 0,
                border: '1px solid rgba(38,37,30,0.1)',
              }}
            />
            <span style={{ minWidth: 140, fontSize: 13 }}>{OBJ_STATUS_CONFIG[strStatus].strLabel}</span>
            <code style={{ fontSize: 11, opacity: 0.75 }}>{strStatus}</code>
            <span style={{ fontSize: 11, opacity: 0.65 }}>{strColor}</span>
          </div>
        );
      })}
    </div>

    <Typography.Title level={5}>이력 Timeline 미리보기</Typography.Title>
    <Timeline
      items={ARR_STATUSES.map((strStatus) => ({
        color: fnStatusTimelineColor(strStatus),
        children: (
          <span>
            <strong>{OBJ_STATUS_CONFIG[strStatus].strLabel}</strong>
            <span style={{ opacity: 0.65, marginLeft: 8, fontSize: 12 }}>{strStatus}</span>
          </span>
        ),
      }))}
    />
  </div>
);

const meta: Meta = {
  title: 'DQPM/WorkflowTimeline',
  component: TimelinePalettePanel,
  parameters: { layout: 'padded' },
};

export default meta;
type TStory = StoryObj;

export const StatusPalette: TStory = {
  render: () => <TimelinePalettePanel />,
};
