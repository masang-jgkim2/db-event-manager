import { Drawer, Segmented, Slider, Switch, Typography, Divider, Button, Tooltip, theme as antdTheme } from 'antd';
import {
  SunOutlined,
  MoonOutlined,
  DesktopOutlined,
  ReloadOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { useThemeStore, ARR_PRIMARY_COLORS, fnGenPalette } from '../stores/useThemeStore';
import type { TThemeMode } from '../stores/useThemeStore';

const { Text, Title } = Typography;

interface ISettingsDrawerProps {
  bOpen: boolean;
  fnOnClose: () => void;
}

// 컬러 팔레트 프리뷰 — primary 컬러 선택 시 팔레트 10단계를 미니 스와치로 표시
const ColorPalettePreview = ({ strColor, bDark }: { strColor: string; bDark: boolean }) => {
  const arrPalette = fnGenPalette(strColor, bDark);
  return (
    <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
      {arrPalette.map((strSwatchColor, nIdx) => (
        <Tooltip key={nIdx} title={`${nIdx + 1}번 (${strSwatchColor})`}>
          <div
            style={{
              width: 18,
              height: 12,
              borderRadius: 2,
              background: strSwatchColor,
              border: nIdx === 5 ? '1.5px solid rgba(0,0,0,0.25)' : 'none',
            }}
          />
        </Tooltip>
      ))}
    </div>
  );
};

const SettingsDrawer = ({ bOpen, fnOnClose }: ISettingsDrawerProps) => {
  const { token } = antdTheme.useToken();

  const strMode = useThemeStore((s) => s.strMode);
  const nFontSize = useThemeStore((s) => s.nFontSize);
  const bCompact = useThemeStore((s) => s.bCompact);
  const strPrimaryColor = useThemeStore((s) => s.strPrimaryColor);
  const fnGetIsDark = useThemeStore((s) => s.fnGetIsDark);

  const fnSetMode = useThemeStore((s) => s.fnSetMode);
  const fnSetFontSize = useThemeStore((s) => s.fnSetFontSize);
  const fnSetCompact = useThemeStore((s) => s.fnSetCompact);
  const fnSetPrimaryColor = useThemeStore((s) => s.fnSetPrimaryColor);
  const fnReset = useThemeStore((s) => s.fnReset);

  const bIsDark = fnGetIsDark();

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
      width={320}
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
          { value: 'light', icon: <SunOutlined />, label: '라이트' },
          { value: 'dark',  icon: <MoonOutlined />, label: '다크' },
          { value: 'system', icon: <DesktopOutlined />, label: '시스템' },
        ]}
      />

      <Divider />

      {/* 포인트 컬러 */}
      <Text style={objSectionTitleStyle}>포인트 컬러</Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ARR_PRIMARY_COLORS.map((objColor) => {
          const bSelected = strPrimaryColor === objColor.strValue;
          // 선택된 컬러의 팔레트 미리보기
          const arrPalette = fnGenPalette(objColor.strValue, bIsDark);

          return (
            <button
              key={objColor.strValue}
              onClick={() => fnSetPrimaryColor(objColor.strValue)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: token.borderRadius,
                border: bSelected
                  ? `2px solid ${objColor.strValue}`
                  : `1px solid ${token.colorBorderSecondary}`,
                background: bSelected ? token.colorPrimaryBg : token.colorBgContainer,
                cursor: 'pointer',
                transition: 'all 0.15s',
                width: '100%',
                textAlign: 'left',
              }}
            >
              {/* primary 원형 스와치 */}
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: objColor.strValue,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {bSelected && <CheckOutlined style={{ color: '#fff', fontSize: 11 }} />}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* 컬러명 */}
                <div style={{ fontSize: 12, fontWeight: bSelected ? 600 : 400, color: token.colorText, marginBottom: 3 }}>
                  {objColor.strLabel}
                </div>
                {/* 10단계 팔레트 스와치 */}
                <div style={{ display: 'flex', gap: 2 }}>
                  {arrPalette.map((strSwatchColor, nIdx) => (
                    <div
                      key={nIdx}
                      style={{
                        flex: 1,
                        height: 8,
                        borderRadius: 2,
                        background: strSwatchColor,
                        opacity: nIdx === 5 ? 1 : 0.85,
                      }}
                    />
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

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

      <Divider />

      {/* 사이드바 너비 안내 */}
      <Text style={{ ...objSectionTitleStyle, marginBottom: 4 }}>사이드바 너비</Text>
      <Text type="secondary" style={{ fontSize: 12 }}>
        사이드바 오른쪽 경계를 좌우로 드래그하여 조절할 수 있습니다.
      </Text>
    </Drawer>
  );
};

export default SettingsDrawer;
