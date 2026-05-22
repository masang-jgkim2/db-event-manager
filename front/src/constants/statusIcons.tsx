import React from 'react';
import {
  EditOutlined,
  SendOutlined,
  SafetyCertificateOutlined,
  RocketOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import type { TEventStatus } from '../types';

type TIconComponent = React.ComponentType<{ style?: React.CSSProperties }>;

/** 프로세스 단계별 아이콘 (재사용) */
export const OBJ_STATUS_ICONS: Record<TEventStatus, TIconComponent> = {
  event_created:      EditOutlined,           // 생성(작성)
  confirm_requested:  SendOutlined,           // 컨펌 요청
  dba_confirmed:      SafetyCertificateOutlined, // DBA 컨펌 완료
  qa_requested:       RocketOutlined,         // QA 반영 요청
  qa_deployed:        ThunderboltOutlined,    // QA 반영 실행
  qa_verified:        CheckCircleOutlined,   // QA 확인
  live_requested:     CloudUploadOutlined,    // LIVE 반영 요청
  live_deployed:      ThunderboltOutlined,   // LIVE 반영 실행
  live_verified:      TrophyOutlined,        // 완료
};

const N_DEFAULT_ICON_SIZE = 14;

/** 단계 아이콘 렌더 (크기/색 지정 가능) */
export function fnRenderStatusIcon(
  strStatus: TEventStatus,
  nSize: number = N_DEFAULT_ICON_SIZE,
  strColor?: string
): React.ReactNode {
  const Icon = OBJ_STATUS_ICONS[strStatus];
  if (!Icon) return null;
  return <Icon style={{ fontSize: nSize, color: strColor }} />;
}
