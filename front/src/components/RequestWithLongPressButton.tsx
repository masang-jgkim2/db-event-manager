import React, { useState, useRef, useCallback } from 'react';
import { Button, Popconfirm, Progress } from 'antd';

const N_DURATION_MIN_MS = 2000;
const N_DURATION_MAX_MS = 3000;
const N_TICK_MS = 50;

export interface IRequestWithLongPressButtonProps {
  /** 일반 클릭 시 버튼 라벨 */
  primaryLabel: React.ReactNode;
  /** 일반 클릭 시 확인 제목 */
  primaryTitle: React.ReactNode;
  /** 일반 클릭 시 확인 후 실행 */
  onPrimaryConfirm: () => void;
  /** 재요청 시 버튼 라벨 */
  rerequestLabel: React.ReactNode;
  /** 재요청 시 확인 제목 */
  rerequestTitle: React.ReactNode;
  /** 재요청 시 설명 (선택) */
  rerequestDescription?: React.ReactNode;
  /** 재요청 확인 후 실행 */
  onRerequestConfirm: () => void;
  /** 재요청만 있을 때 true (short click 무반응, 롱프레스 후 클릭만 재요청) */
  bRerequestOnly?: boolean;
  /** primary 버튼 스타일 (배경색 등) */
  primaryButtonStyle?: React.CSSProperties;
  /** primary 버튼 아이콘 */
  primaryIcon?: React.ReactNode;
  /** 재요청 버튼 아이콘 */
  rerequestIcon?: React.ReactNode;
  okText?: string;
  rerequestOkText?: string;
  cancelText?: string;
}

/**
 * 재미 모드용: 한 버튼에서 일반 요청(클릭) / 재요청(롱프레스 2~3초 후 클릭) 지원.
 * 롱프레스 시 버튼 아래 게이지가 차고, 100%가 되면 재요청 모드로 전환된다.
 */
const RequestWithLongPressButton = ({
  primaryLabel,
  primaryTitle,
  onPrimaryConfirm,
  rerequestLabel,
  rerequestTitle,
  rerequestDescription,
  onRerequestConfirm,
  bRerequestOnly = false,
  primaryButtonStyle,
  primaryIcon,
  rerequestIcon,
  okText = '요청',
  rerequestOkText = '재요청',
  cancelText = '취소',
}: IRequestWithLongPressButtonProps) => {
  const [nProgress, setNProgress] = useState(0);
  const [bReRequestMode, setBReRequestMode] = useState(false);
  const [bConfirmOpen, setBConfirmOpen] = useState(false);
  const [bConfirmIsRerequest, setBConfirmIsRerequest] = useState(false);

  const nTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nStartRef = useRef<number>(0);
  const nDurationRef = useRef<number>(N_DURATION_MIN_MS);

  const fnClearTimer = useCallback(() => {
    if (nTimerRef.current) {
      clearInterval(nTimerRef.current);
      nTimerRef.current = null;
    }
  }, []);

  const fnStartGauge = useCallback(() => {
    fnClearTimer();
    setNProgress(0);
    nStartRef.current = Date.now();
    // 매번 2~3초 랜덤
    nDurationRef.current = N_DURATION_MIN_MS + Math.random() * (N_DURATION_MAX_MS - N_DURATION_MIN_MS);
    nTimerRef.current = setInterval(() => {
      const nElapsed = Date.now() - nStartRef.current;
      const nPct = Math.min(100, (nElapsed / nDurationRef.current) * 100);
      setNProgress(nPct);
      if (nPct >= 100) {
        fnClearTimer();
        setBReRequestMode(true);
        setNProgress(0);
      }
    }, N_TICK_MS);
  }, [fnClearTimer]);

  const fnStopGauge = useCallback(() => {
    fnClearTimer();
    const nElapsed = Date.now() - nStartRef.current;
    if (nElapsed >= nDurationRef.current) {
      setBReRequestMode(true);
    }
    setNProgress(0);
  }, [fnClearTimer]);

  const fnHandlePointerDown: React.PointerEventHandler = useCallback((e) => {
    if (bReRequestMode) return;
    e.preventDefault();
    fnStartGauge();
  }, [bReRequestMode, fnStartGauge]);

  const fnHandlePointerUp = useCallback(() => {
    fnStopGauge();
  }, [fnStopGauge]);

  const fnHandlePointerLeave = useCallback(() => {
    fnStopGauge();
  }, [fnStopGauge]);

  const fnHandleClick = useCallback(() => {
    if (bReRequestMode) {
      setBConfirmIsRerequest(true);
      setBConfirmOpen(true);
      setBReRequestMode(false);
    } else {
      if (bRerequestOnly) return;
      setBConfirmIsRerequest(false);
      setBConfirmOpen(true);
    }
  }, [bReRequestMode, bRerequestOnly]);

  const fnConfirm = useCallback(() => {
    if (bConfirmIsRerequest) {
      onRerequestConfirm();
    } else {
      onPrimaryConfirm();
    }
    setBConfirmOpen(false);
  }, [bConfirmIsRerequest, onPrimaryConfirm, onRerequestConfirm]);

  const bShowPrimary = !bReRequestMode;
  const btnLabel = bShowPrimary ? primaryLabel : rerequestLabel;
  const btnIcon = bShowPrimary ? primaryIcon : rerequestIcon;
  const btnStyle: React.CSSProperties = bShowPrimary
    ? (primaryButtonStyle ?? {})
    : { borderColor: 'var(--ant-color-warning)', color: 'var(--ant-color-warning)' };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'stretch', gap: 2 }}>
      <Popconfirm
        open={bConfirmOpen}
        onOpenChange={setBConfirmOpen}
        title={bConfirmIsRerequest ? rerequestTitle : primaryTitle}
        description={bConfirmIsRerequest ? rerequestDescription : undefined}
        okText={bConfirmIsRerequest ? rerequestOkText : okText}
        cancelText={cancelText}
        onConfirm={fnConfirm}
      >
        <span
          style={{ display: 'inline-block' }}
          onPointerDown={fnHandlePointerDown}
          onPointerUp={fnHandlePointerUp}
          onPointerLeave={fnHandlePointerLeave}
          onPointerCancel={fnHandlePointerUp}
        >
          <Button
            size="small"
            icon={btnIcon}
            style={{ ...btnStyle, minWidth: 120 }}
            onClick={fnHandleClick}
          >
            {btnLabel}
          </Button>
        </span>
      </Popconfirm>
      {!bReRequestMode && nProgress > 0 && nProgress < 100 && (
        <Progress
          percent={Math.round(nProgress)}
          size="small"
          showInfo={false}
          status="active"
          style={{ marginBottom: 0, marginTop: 0 }}
        />
      )}
    </div>
  );
};

export default RequestWithLongPressButton;
