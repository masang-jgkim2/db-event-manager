import { Space, Switch, Tooltip, Typography } from 'antd';
import type { SwitchProps } from 'antd';

const { Text } = Typography;

export interface ILabeledSwitchProps {
  /** 스위치 왼쪽 라벨 (예: 실시간 갱신, 자동 연결) */
  strLabel: string;
  bChecked: boolean;
  onChange: (bChecked: boolean) => void;
  /** 있으면 Switch에 Tooltip */
  strTooltip?: string;
  bDisabled?: boolean;
  /** Ant Switch size — 기본 default (CRUD 헤더용) */
  size?: SwitchProps['size'];
}

/**
 * CRUD 페이지 헤더용 — 라벨 + Switch (Activity「실시간 갱신」, DB 접속「자동 연결」 공통)
 */
const LabeledSwitch = ({
  strLabel,
  bChecked,
  onChange,
  strTooltip,
  bDisabled,
  size,
}: ILabeledSwitchProps) => {
  const nodeSwitch = (
    <Switch
      checked={bChecked}
      onChange={onChange}
      disabled={bDisabled}
      size={size}
    />
  );

  return (
    <Space align="center" size="small">
      <Text type="secondary" style={{ fontSize: 12 }}>{strLabel}</Text>
      {strTooltip ? <Tooltip title={strTooltip}>{nodeSwitch}</Tooltip> : nodeSwitch}
    </Space>
  );
};

export default LabeledSwitch;
