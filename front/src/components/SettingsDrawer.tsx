import { Drawer, Segmented, Slider, Switch, Typography, Divider, Button, Tooltip, theme as antdTheme } from 'antd';
import {
  SunOutlined,
  MoonOutlined,
  DesktopOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useThemeStore, ARR_PRIMARY_COLORS } from '../stores/useThemeStore';
import type { TThemeMode } from '../stores/useThemeStore';

const { Text, Title } = Typography;

interface ISettingsDrawerProps {
  bOpen: boolean;
  fnOnClose: () => void;
}

const SettingsDrawer = ({ bOpen, fnOnClose }: ISettingsDrawerProps) => {
  const { token } = antdTheme.useToken();

  const strMode = useThemeStore((s) => s.strMode);
  const nSiderWidth = useThemeStore((s) => s.nSiderWidth);
  const nFontSize = useThemeStore((s) => s.nFontSize);
  const bCompact = useThemeStore((s) => s.bCompact);
  const strPrimaryColor = useThemeStore((s) => s.strPrimaryColor);

  const fnSetMode = useThemeStore((s) => s.fnSetMode);
  const fnSetSiderWidth = useThemeStore((s) => s.fnSetSiderWidth);
  const fnSetFontSize = useThemeStore((s) => s.fnSetFontSize);
  const fnSetCompact = useThemeStore((s) => s.fnSetCompact);
  const fnSetPrimaryColor = useThemeStore((s) => s.fnSetPrimaryColor);
  const fnReset = useThemeStore((s) => s.fnReset);

  // 섹션 제목 스타일
  const objSectionTitleStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: token.colorTextSecondary,
    marginBottom: 12,
    display: 'block',
  };

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={5} style={{ margin: 0 }}>UI 설정</Title>
          <Tooltip title="기본값으로 초기화">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={fnReset}
            >
              초기화
            </Button>
          </Tooltip>
        </div>
      }
      placement="right"
      width={300}
      open={bOpen}
      onClose={fnOnClose}
      closable
      styles={{ body: { padding: '20px 24px' } }}
    >
      {/* 테마 모드 */}
      <Text style={objSectionTitleStyle}>테마 모드</Text>
      <Segmented<TThemeMode>
        block
        value={strMode}
        onChange={fnSetMode}
        options={[
          {
            value: 'light',
            icon: <SunOutlined />,
            label: '라이트',
          },
          {
            value: 'dark',
            icon: <MoonOutlined />,
            label: '다크',
          },
          {
            value: 'system',
            icon: <DesktopOutlined />,
            label: '시스템',
          },
        ]}
      />

      <Divider />

      {/* 포인트 컬러 */}
      <Text style={objSectionTitleStyle}>포인트 컬러</Text>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {ARR_PRIMARY_COLORS.map((objColor) => {
          const bSelected = strPrimaryColor === objColor.strValue;
          return (
            <Tooltip key={objColor.strValue} title={objColor.strLabel}>
              <button
                onClick={() => fnSetPrimaryColor(objColor.strValue)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: objColor.strValue,
                  border: bSelected ? `3px solid ${token.colorBgContainer}` : '2px solid transparent',
                  outline: bSelected ? `2px solid ${objColor.strValue}` : 'none',
                  cursor: 'pointer',
                  transition: 'transform 0.15s, outline 0.15s',
                  transform: bSelected ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            </Tooltip>
          );
        })}
      </div>

      <Divider />

      {/* 사이드바 너비 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={objSectionTitleStyle}>사이드바 너비</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>{nSiderWidth}px</Text>
      </div>
      <Slider
        min={160}
        max={300}
        step={10}
        value={nSiderWidth}
        onChange={fnSetSiderWidth}
        marks={{ 160: '160', 200: '200', 250: '250', 300: '300' }}
      />

      <Divider />

      {/* 폰트 크기 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={objSectionTitleStyle}>폰트 크기</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>{nFontSize}px</Text>
      </div>
      <Slider
        min={12}
        max={16}
        step={1}
        value={nFontSize}
        onChange={fnSetFontSize}
        marks={{ 12: '12', 13: '13', 14: '14', 15: '15', 16: '16' }}
      />

      <Divider />

      {/* 컴팩트 모드 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text style={{ ...objSectionTitleStyle, marginBottom: 2 }}>컴팩트 모드</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>테이블/폼 등 여백 축소</Text>
        </div>
        <Switch checked={bCompact} onChange={fnSetCompact} />
      </div>
    </Drawer>
  );
};

export default SettingsDrawer;
