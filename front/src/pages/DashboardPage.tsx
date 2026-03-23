import React, { useEffect, useState, useCallback, useMemo, useLayoutEffect, useRef } from 'react';
import {
  Card, Typography, Tag, Space, Button, theme, Modal, Steps, Checkbox, Input, Select, InputNumber, Segmented, Collapse, Table,
  Divider, Spin, DatePicker,
} from 'antd';
import dayjs from 'dayjs';
import { Resizable } from 're-resizable';
import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import AppTable from '../components/AppTable';
import {
  DashboardCardContent,
  DashboardCardTitleDragProvider,
  fnDashboardCardIcon,
  N_DASHBOARD_ICON_SIZE,
  N_DASHBOARD_VALUE_FONT_SIZE,
} from '../components/DashboardCardContent';
import {
  AppstoreOutlined,
  CalendarOutlined,
  CodeOutlined,
  TeamOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { useProductStore } from '../stores/useProductStore';
import { useEventStore } from '../stores/useEventStore';
import { useAuthStore } from '../stores/useAuthStore';
import { fnApiGetInstances } from '../api/eventInstanceApi';
import { fnApiGetDbConnections } from '../api/dbConnectionApi';
import { fnApiGetUsers } from '../api/userApi';
import { fnApiGetRoles } from '../api/roleApi';
import type { IProduct, IService, TEventStatus, IEventInstance } from '../types';
import { OBJ_STATUS_CONFIG } from '../types';
import { fnRenderStatusIcon } from '../constants/statusIcons';
import type { ICustomEventDashboardCard, ICustomDashboardEventGroup } from '../types/eventDashboardCustom';

const { Title, Text } = Typography;

const ARR_EVENT_STATUSES: TEventStatus[] = [
  'event_created', 'confirm_requested', 'dba_confirmed',
  'qa_requested', 'qa_deployed', 'qa_verified',
  'live_requested', 'live_deployed', 'live_verified',
];

const STATUS_CARD_IDS = [
  'status_event_created', 'status_confirm_requested', 'status_dba_confirmed',
  'status_qa_requested', 'status_qa_deployed', 'status_qa_verified',
  'status_live_requested', 'status_live_deployed', 'status_live_verified',
] as const;

/** 숫자 형태 카드 ID */
const NUMBER_CARD_IDS = [
  'product', 'eventTemplate', 'instance', 'service', 'dbConnection', 'user', 'role',
  'instanceInProgress', 'instanceCompleted',
  ...STATUS_CARD_IDS,
] as const;
/** 테이블 형태 카드 ID */
const TABLE_CARD_IDS = ['productTable'] as const;

const DASHBOARD_CARD_IDS = [
  ...NUMBER_CARD_IDS,
  ...TABLE_CARD_IDS,
] as const;
type TDashboardCardId = (typeof DASHBOARD_CARD_IDS)[number];

const fnIsStatusCardId = (strId: string): strId is `status_${TEventStatus}` =>
  strId.startsWith('status_') && ARR_EVENT_STATUSES.includes(strId.replace('status_', '') as TEventStatus);

const fnGetStatusCardLabel = (strStatus: TEventStatus) => OBJ_STATUS_CONFIG[strStatus].strLabel;

const OBJ_CARD_LABELS: Record<TDashboardCardId, string> = {
  product: '프로덕트',
  eventTemplate: '이벤트 템플릿',
  instance: '이벤트 인스턴스',
  service: '서비스(국내/해외)',
  dbConnection: 'DB 접속',
  user: '사용자',
  role: '역할',
  instanceInProgress: '진행 중',
  instanceCompleted: '완료',
  status_event_created: fnGetStatusCardLabel('event_created'),
  status_confirm_requested: fnGetStatusCardLabel('confirm_requested'),
  status_dba_confirmed: fnGetStatusCardLabel('dba_confirmed'),
  status_qa_requested: fnGetStatusCardLabel('qa_requested'),
  status_qa_deployed: fnGetStatusCardLabel('qa_deployed'),
  status_qa_verified: fnGetStatusCardLabel('qa_verified'),
  status_live_requested: fnGetStatusCardLabel('live_requested'),
  status_live_deployed: fnGetStatusCardLabel('live_deployed'),
  status_live_verified: fnGetStatusCardLabel('live_verified'),
  productTable: '프로덕트 현황 테이블',
};

/** 테이블 카드 ID → AppTable strTableId */
const OBJ_TABLE_CARD_TABLE_IDS: Record<(typeof TABLE_CARD_IDS)[number], string> = {
  productTable: 'dashboard_products',
};
/** 테이블 카드별 컬럼 메타 (추가 모달 컬럼 선택용) */
const OBJ_TABLE_CARD_COLUMNS: Record<(typeof TABLE_CARD_IDS)[number], { key: string; title: string }[]> = {
  productTable: [
    { key: 'strName', title: '프로젝트명' },
    { key: 'arrServices', title: '서비스' },
    { key: 'eventCount', title: '이벤트 템플릿 수' },
  ],
};

const STORAGE_KEY = 'db-event-manager-dashboard-cards';
const STORAGE_KEY_SIZES = 'db-event-manager-dashboard-card-sizes';
const STORAGE_KEY_ORDER = 'db-event-manager-dashboard-card-order';
const STORAGE_KEY_TABLE_SIZE = 'db-event-manager-dashboard-table-size';
const STORAGE_KEY_CUSTOM = 'db-event-manager-dashboard-custom-cards';

const fnIsCustomDashboardId = (strId: string) => strId.startsWith('custom_');

const fnLoadCustomCards = (): ICustomEventDashboardCard[] => {
  try {
    const str = localStorage.getItem(STORAGE_KEY_CUSTOM);
    if (!str) return [];
    const arr = JSON.parse(str) as ICustomEventDashboardCard[];
    if (!Array.isArray(arr)) return [];
    return arr.filter((c) => {
      if (
        !c ||
        typeof c.strId !== 'string' ||
        !fnIsCustomDashboardId(c.strId) ||
        typeof c.strTitle !== 'string'
      ) {
        return false;
      }
      const bHasMetrics = Array.isArray(c.arrRows) && c.arrRows.length > 0;
      const bHasGroups = Array.isArray(c.arrEventGroups) && c.arrEventGroups.length > 0;
      return bHasMetrics || bHasGroups;
    });
  } catch {
    return [];
  }
};

const fnSaveCustomCards = (arr: ICustomEventDashboardCard[]) => {
  localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(arr));
};

const fnNewCustomId = () => `custom_${crypto.randomUUID()}`;
const fnVisibleColStorageKey = (strTableId: string) => `app_table_col_visible_${strTableId}`;

/** 맞춤 카드 모달 — 이벤트 그룹 행(저장 시 ICustomDashboardEventGroup 으로 변환) */
interface ICustomDashboardEventGroupFormRow {
  strTitle: string;
  arrStatus: TEventStatus[];
  bInProgressOnly: boolean;
  strDateBasis: 'deploy' | 'created';
  strPeriodStart?: string;
  strPeriodEnd?: string;
}

const fnDefaultCustomGroupFormRow = (): ICustomDashboardEventGroupFormRow => ({
  strTitle: '',
  arrStatus: [],
  bInProgressOnly: true,
  strDateBasis: 'deploy',
});

type TTableSize = 'small' | 'middle' | 'large';

const N_STATUS_CARD_W = 200;
/** 카드 숫자/값 공통 스타일 (아이콘·제목과 일관성) */
const OBJ_CARD_VALUE_STYLE: React.CSSProperties = { fontSize: N_DASHBOARD_VALUE_FONT_SIZE, fontWeight: 600 };
const N_STATUS_CARD_H = 88;

const DEFAULT_SIZES: Record<TDashboardCardId, { width: number; height: number }> = {
  product: { width: 260, height: 100 },
  eventTemplate: { width: 260, height: 100 },
  instance: { width: 260, height: 100 },
  service: { width: 260, height: 100 },
  dbConnection: { width: 260, height: 100 },
  user: { width: 260, height: 100 },
  role: { width: 260, height: 100 },
  instanceInProgress: { width: N_STATUS_CARD_W, height: N_STATUS_CARD_H },
  instanceCompleted: { width: N_STATUS_CARD_W, height: N_STATUS_CARD_H },
  status_event_created: { width: N_STATUS_CARD_W, height: N_STATUS_CARD_H },
  status_confirm_requested: { width: N_STATUS_CARD_W, height: N_STATUS_CARD_H },
  status_dba_confirmed: { width: N_STATUS_CARD_W, height: N_STATUS_CARD_H },
  status_qa_requested: { width: N_STATUS_CARD_W, height: N_STATUS_CARD_H },
  status_qa_deployed: { width: N_STATUS_CARD_W, height: N_STATUS_CARD_H },
  status_qa_verified: { width: N_STATUS_CARD_W, height: N_STATUS_CARD_H },
  status_live_requested: { width: N_STATUS_CARD_W, height: N_STATUS_CARD_H },
  status_live_deployed: { width: N_STATUS_CARD_W, height: N_STATUS_CARD_H },
  status_live_verified: { width: N_STATUS_CARD_W, height: N_STATUS_CARD_H },
  productTable: { width: 900, height: 380 },
};

const fnLoadEnabledCards = (arrCustom: ICustomEventDashboardCard[]): string[] => {
  const setCustom = new Set(arrCustom.map((c) => c.strId));
  try {
    const str = localStorage.getItem(STORAGE_KEY);
    if (!str) return [...DASHBOARD_CARD_IDS];
    let arr = JSON.parse(str) as string[];
    if (arr.includes('instanceByStatus')) {
      arr = arr.filter((id: string) => id !== 'instanceByStatus');
      arr = [...arr, ...STATUS_CARD_IDS];
    }
    return arr.filter((id) => {
      if (DASHBOARD_CARD_IDS.includes(id as TDashboardCardId)) return true;
      if (fnIsCustomDashboardId(id) && setCustom.has(id)) return true;
      return false;
    });
  } catch {
    return [...DASHBOARD_CARD_IDS];
  }
};

const fnSaveEnabledCards = (arr: string[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
};

/** 카드 영역(고정 위치·크기) — localStorage 키는 기존 SIZES 유지, 값에 x,y 포함 */
export interface ICardRect {
  width: number;
  height: number;
  x: number;
  y: number;
}

const fnLoadCardLayoutRaw = (): Partial<Record<string, Partial<ICardRect>>> => {
  try {
    const str = localStorage.getItem(STORAGE_KEY_SIZES);
    if (!str) return {};
    return JSON.parse(str) as Partial<Record<string, Partial<ICardRect>>>;
  } catch {
    return {};
  }
};

const fnDefaultSizeOnly = (strId: string): { width: number; height: number } => {
  if (fnIsCustomDashboardId(strId)) return { width: 360, height: 320 };
  if (DASHBOARD_CARD_IDS.includes(strId as TDashboardCardId)) return DEFAULT_SIZES[strId as TDashboardCardId];
  return { width: 280, height: 160 };
};

const N_LAYOUT_GRID_GAP = 16;
const fnGridSlotByIndex = (nIdx: number) => ({
  x: N_LAYOUT_GRID_GAP + (nIdx % 4) * (260 + N_LAYOUT_GRID_GAP),
  y: N_LAYOUT_GRID_GAP + Math.floor(nIdx / 4) * (120 + N_LAYOUT_GRID_GAP),
});

/** 첫 로드 시 x,y 없으면 격자로 채움 — 이후 절대좌표·드래그 이동만 사용 */
const fnBuildInitialCardLayout = (): Partial<Record<string, ICardRect>> => {
  const arrCustom = fnLoadCustomCards();
  const arrEn = fnLoadEnabledCards(arrCustom);
  const arrOrd = fnLoadCardOrder(arrCustom);
  const map: Partial<Record<string, ICardRect>> = {};
  const raw = fnLoadCardLayoutRaw();
  let nVis = 0;
  let bDirty = false;
  for (const strId of arrOrd) {
    if (!arrEn.includes(strId)) continue;
    const cur = raw[strId];
    const def = fnDefaultSizeOnly(strId);
    const w = cur?.width ?? def.width;
    const h = cur?.height ?? def.height;
    if (typeof cur?.x !== 'number' || typeof cur?.y !== 'number') {
      const slot = fnGridSlotByIndex(nVis);
      map[strId] = { width: w, height: h, x: slot.x, y: slot.y };
      bDirty = true;
    } else {
      map[strId] = { width: w, height: h, x: cur.x!, y: cur.y! };
    }
    nVis++;
  }
  if (bDirty) localStorage.setItem(STORAGE_KEY_SIZES, JSON.stringify(map));
  return map;
};

const fnSaveCardLayoutMap = (map: Partial<Record<string, ICardRect>>) => {
  localStorage.setItem(STORAGE_KEY_SIZES, JSON.stringify(map));
};

/** 카드 사이 최소 여백(px) — 겹침 판정 시 포함 */
const N_CARD_MIN_GAP = 8;

const fnCardRectsOverlap = (a: ICardRect, b: ICardRect): boolean => {
  const g = N_CARD_MIN_GAP;
  return !(
    a.x + a.width + g <= b.x ||
    b.x + b.width + g <= a.x ||
    a.y + a.height + g <= b.y ||
    b.y + b.height + g <= a.y
  );
};

/** 이동 카드를 고정 카드와 겹치지 않게 최소 평행 이동 */
const fnPushOutFromFixed = (moving: ICardRect, fixed: ICardRect): ICardRect => {
  const g = N_CARD_MIN_GAP;
  if (!fnCardRectsOverlap(moving, fixed)) return moving;
  const nPushLeft = moving.x + moving.width + g - fixed.x;
  const nPushRight = fixed.x + fixed.width + g - moving.x;
  const nPushUp = moving.y + moving.height + g - fixed.y;
  const nPushDown = fixed.y + fixed.height + g - moving.y;
  const arrOpts: { dx: number; dy: number; cost: number }[] = [];
  if (nPushLeft > 0) arrOpts.push({ dx: -nPushLeft, dy: 0, cost: nPushLeft });
  if (nPushRight > 0) arrOpts.push({ dx: nPushRight, dy: 0, cost: nPushRight });
  if (nPushUp > 0) arrOpts.push({ dx: 0, dy: -nPushUp, cost: nPushUp });
  if (nPushDown > 0) arrOpts.push({ dx: 0, dy: nPushDown, cost: nPushDown });
  if (arrOpts.length === 0) return { ...moving, x: moving.x + g, y: moving.y + g };
  arrOpts.sort((p, q) => p.cost - q.cost);
  const o = arrOpts[0]!;
  return { ...moving, x: moving.x + o.dx, y: moving.y + o.dy };
};

/**
 * 방금 움직인/크기 바뀐 카드 1장만 다른 보이는 카드들과 겹치지 않게 위치 보정(x,y)
 */
const fnApplyOverlapResolveForMovedCard = (
  map: Partial<Record<string, ICardRect>>,
  strMoved: string,
  arrVisibleIds: string[],
  nMaxIter = 64,
): Partial<Record<string, ICardRect>> => {
  const cur = map[strMoved];
  if (!cur) return map;
  let rect = { ...cur };
  const arrOthers = arrVisibleIds.filter((id) => id !== strMoved);
  for (let nIter = 0; nIter < nMaxIter; nIter++) {
    let bAdjusted = false;
    for (const strO of arrOthers) {
      const ob = map[strO];
      if (!ob) continue;
      if (fnCardRectsOverlap(rect, ob)) {
        rect = fnPushOutFromFixed(rect, ob);
        bAdjusted = true;
      }
    }
    if (!bAdjusted) break;
  }
  rect.x = Math.max(0, rect.x);
  rect.y = Math.max(0, rect.y);
  if (rect.x === cur.x && rect.y === cur.y) return map;
  return { ...map, [strMoved]: rect };
};

const fnLoadCardOrder = (arrCustom: ICustomEventDashboardCard[]): string[] => {
  const setCustom = new Set(arrCustom.map((c) => c.strId));
  try {
    const str = localStorage.getItem(STORAGE_KEY_ORDER);
    if (!str) return [...DASHBOARD_CARD_IDS];
    let arr = JSON.parse(str) as string[];
    if (arr.includes('instanceByStatus')) {
      const nIdx = arr.indexOf('instanceByStatus');
      arr = arr.filter((id: string) => id !== 'instanceByStatus');
      arr = [...arr.slice(0, nIdx), ...STATUS_CARD_IDS, ...arr.slice(nIdx)];
    }
    return arr.filter((id) => {
      if (DASHBOARD_CARD_IDS.includes(id as TDashboardCardId)) return true;
      if (fnIsCustomDashboardId(id) && setCustom.has(id)) return true;
      return false;
    });
  } catch {
    return [...DASHBOARD_CARD_IDS];
  }
};

const fnSaveCardOrder = (arr: string[]) => {
  localStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(arr));
};

const fnLoadTableSize = (): TTableSize => {
  const s = localStorage.getItem(STORAGE_KEY_TABLE_SIZE);
  if (s === 'small' || s === 'middle' || s === 'large') return s;
  return 'middle';
};

/** 테이블별 표시 컬럼 키 로드 (없으면 null = 전체 표시) */
const fnLoadVisibleColumnKeys = (strTableId: string): string[] | null => {
  try {
    const str = localStorage.getItem(fnVisibleColStorageKey(strTableId));
    if (!str) return null;
    const arr = JSON.parse(str) as string[];
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
};
const fnSaveVisibleColumnKeys = (strTableId: string, arrKeys: string[]): void => {
  localStorage.setItem(fnVisibleColStorageKey(strTableId), JSON.stringify(arrKeys));
};

const fnIsInProgress = (strStatus: string) => strStatus !== 'live_verified';

/** 맞춤 그룹 기간 비교용 일시(없으면 null) */
const fnGetInstanceDateForGroupBasis = (
  i: IEventInstance,
  strBasis: 'deploy' | 'created',
): dayjs.Dayjs | null => {
  const strRaw = strBasis === 'created' ? i.dtCreatedAt : i.dtDeployDate;
  if (!strRaw || String(strRaw).trim() === '') return null;
  const dt = dayjs(strRaw);
  return dt.isValid() ? dt : null;
};

/** 맞춤 카드 이벤트 그룹 필터 — 삭제 제외·진행·상태·기간 AND */
const fnFilterInstancesForCustomGroup = (
  objGroup: ICustomDashboardEventGroup,
  arrSrc: IEventInstance[],
): IEventInstance[] =>
  arrSrc.filter((i) => {
    if (i.bPermanentlyRemoved) return false;
    if (objGroup.bInProgressOnly && !fnIsInProgress(i.strStatus)) return false;
    if (
      objGroup.arrStatus &&
      objGroup.arrStatus.length > 0 &&
      !objGroup.arrStatus.includes(i.strStatus)
    ) {
      return false;
    }
    const strS = objGroup.strPeriodStart?.trim();
    const strE = objGroup.strPeriodEnd?.trim();
    if (!strS && !strE) return true;
    const strBasis = objGroup.strDateBasis ?? 'deploy';
    const dtI = fnGetInstanceDateForGroupBasis(i, strBasis);
    if (!dtI) return false;
    const dtDay = dtI.startOf('day');
    if (strS) {
      const dtFrom = dayjs(strS).startOf('day');
      if (!dtFrom.isValid() || dtDay.isBefore(dtFrom)) return false;
    }
    if (strE) {
      const dtTo = dayjs(strE).endOf('day');
      if (!dtTo.isValid() || dtDay.isAfter(dtTo)) return false;
    }
    return true;
  });

/** 시작·종료 YYYY-MM-DD 차이 일수 표시(같은 날 0, 마지막−시작) */
const fnFormatPeriodDaySpan = (strStart?: string, strEnd?: string): string | null => {
  if (!strStart?.trim() || !strEnd?.trim()) return null;
  const a = dayjs(strStart).startOf('day');
  const b = dayjs(strEnd).startOf('day');
  if (!a.isValid() || !b.isValid()) return null;
  const nDiff = b.diff(a, 'day');
  return `${nDiff}일`;
};

// 리사이즈 가능 + 호버 시 제외(-) 버튼, 호버 시 카드 영역 드래그로 이동
interface IDragHandleProps {
  listeners: Record<string, unknown>;
  attributes: Record<string, unknown>;
  isDragging: boolean;
}

interface IDashboardCardBoxProps {
  strCardId: string;
  size: { width: number; height: number };
  onResizeStop: (w: number, h: number) => void;
  onRemove: () => void;
  children: React.ReactNode;
  bCompact?: boolean;
  dragHandleProps?: IDragHandleProps;
  /** true: 카드 전체가 아니라 제목 줄만 드래그(내부 Collapse·테이블 조작과 분리, 호버 시 래퍼 전환 없음) */
  bDragFromTitleOnly?: boolean;
  /** 설정 시 내부 실제 높이를 측정해 카드 높이 자동 반영(맞춤 카드 테이블 펼침 등) */
  fnReportNaturalHeight?: (nPixel: number) => void;
}

const DashboardCardBox = ({
  strCardId,
  size,
  onResizeStop,
  onRemove,
  children,
  bCompact,
  dragHandleProps,
  bDragFromTitleOnly,
  fnReportNaturalHeight,
}: IDashboardCardBoxProps) => {
  const [bHover, setBHover] = useState(false);
  const { token } = theme.useToken();
  const refMeasure = useRef<HTMLDivElement>(null);

  const cardStyle: React.CSSProperties =
    bDragFromTitleOnly || fnReportNaturalHeight
      ? { height: 'auto', minHeight: '100%' }
      : { height: '100%' };

  const cardContent = bCompact ? (
    <Card size="small" style={cardStyle} styles={{ body: { height: 'auto' } }}>
      {children}
    </Card>
  ) : (
    <Card hoverable style={cardStyle} styles={{ body: { height: 'auto' } }}>
      {children}
    </Card>
  );

  // 제목 전용: 구조 고정(리마운트 없음) — Collapse 열림 상태 유지
  const wrapWithDrag = Boolean(dragHandleProps && bHover && !bDragFromTitleOnly);
  const cursorStyle = wrapWithDrag
    ? { cursor: dragHandleProps!.isDragging ? 'grabbing' : ('grab' as const) }
    : undefined;

  const refNaturalCb = useRef(fnReportNaturalHeight);
  refNaturalCb.current = fnReportNaturalHeight;
  const bNaturalHeightOn = Boolean(fnReportNaturalHeight);
  useLayoutEffect(() => {
    const el = refMeasure.current;
    if (!el || !bNaturalHeightOn) return;
    let nRaf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(nRaf);
      nRaf = requestAnimationFrame(() => {
        const nH = el.getBoundingClientRect().height;
        refNaturalCb.current?.(nH);
      });
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(nRaf);
      ro.disconnect();
    };
  }, [bNaturalHeightOn, size.width, size.height]);

  const innerBody = (() => {
    if (bDragFromTitleOnly && dragHandleProps) {
      return (
        <DashboardCardTitleDragProvider value={dragHandleProps}>
          {cardContent}
        </DashboardCardTitleDragProvider>
      );
    }
    if (wrapWithDrag) {
      return (
        <div
          {...dragHandleProps!.listeners}
          {...dragHandleProps!.attributes}
          style={{ height: '100%', ...cursorStyle }}
        >
          {cardContent}
        </div>
      );
    }
    return cardContent;
  })();

  return (
    <Resizable
      data-dashboard-card-id={strCardId}
      size={size}
      minWidth={120}
      minHeight={60}
      onResizeStop={(_e, _dir, ref, _d) => {
        const w = ref.offsetWidth;
        const h = ref.offsetHeight;
        onResizeStop(w, h);
      }}
      enable={{ top: true, right: true, bottom: true, left: true, topRight: true, bottomRight: true, bottomLeft: true, topLeft: true }}
      handleStyles={{
        right: { right: 0, width: 8, cursor: 'ew-resize' },
        bottom: { bottom: 0, height: 8, cursor: 'ns-resize' },
        bottomRight: { width: 14, height: 14, cursor: 'nwse-resize', right: 0, bottom: 0 },
      }}
      style={{ margin: 0, position: 'relative' }}
    >
      <div
        ref={refMeasure}
        onMouseEnter={() => setBHover(true)}
        onMouseLeave={() => setBHover(false)}
        style={{
          height: fnReportNaturalHeight || bDragFromTitleOnly ? 'auto' : '100%',
          minHeight:
            fnReportNaturalHeight || bDragFromTitleOnly ? size.height : undefined,
          position: 'relative',
        }}
      >
        {bHover && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="카드 제외"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 10,
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: 'none',
              background: token.colorError,
              color: token.colorTextLightSolid,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <MinusOutlined style={{ fontSize: 12 }} />
          </button>
        )}
        {innerBody}
      </div>
    </Resizable>
  );
};

/** 고정 좌표 캔버스 위에서 드래그로 이동(델타 누적은 DndContext onDragEnd) */
interface IAbsoluteCardWrapperProps {
  strCardId: string;
  objLayout: ICardRect;
  nZIndex: number;
  onResizeStop: (w: number, h: number) => void;
  onRemove: () => void;
  bCompact?: boolean;
  bDragFromTitleOnly?: boolean;
  fnReportNaturalHeight?: (nPixel: number) => void;
  children: React.ReactNode;
}

const AbsoluteDraggableCardWrapper = ({
  strCardId,
  objLayout,
  nZIndex,
  onResizeStop,
  onRemove,
  bCompact,
  bDragFromTitleOnly,
  fnReportNaturalHeight,
  children,
}: IAbsoluteCardWrapperProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: strCardId });
  const size = { width: objLayout.width, height: objLayout.height };
  const bFlowHeight = Boolean(bDragFromTitleOnly || fnReportNaturalHeight);

  const objStyle: React.CSSProperties = {
    position: 'absolute',
    left: objLayout.x,
    top: objLayout.y,
    width: objLayout.width,
    height: bFlowHeight ? 'auto' : objLayout.height,
    minHeight: bFlowHeight ? objLayout.height : undefined,
    zIndex: isDragging ? 1000 : nZIndex,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.92 : 1,
  };

  return (
    <div ref={setNodeRef} style={objStyle}>
      <DashboardCardBox
        strCardId={strCardId}
        size={size}
        onResizeStop={onResizeStop}
        onRemove={onRemove}
        bCompact={bCompact}
        bDragFromTitleOnly={bDragFromTitleOnly}
        fnReportNaturalHeight={fnReportNaturalHeight}
        dragHandleProps={{ listeners, attributes, isDragging }}
      >
        {children}
      </DashboardCardBox>
    </div>
  );
};

const DashboardPage = () => {
  const arrProducts = useProductStore((s) => s.arrProducts);
  const arrEvents = useEventStore((s) => s.arrEvents);
  const fnFetchProducts = useProductStore((s) => s.fnFetchProducts);
  const fnFetchEvents = useEventStore((s) => s.fnFetchEvents);
  const arrPermissions = useAuthStore((s) => s.user?.arrPermissions ?? []);

  const fnHas = (strPerm: string) => arrPermissions.includes(strPerm);

  const [arrCustomCards, setArrCustomCards] = useState<ICustomEventDashboardCard[]>(fnLoadCustomCards);
  const [arrEnabledCardIds, setArrEnabledCardIds] = useState<string[]>(() => fnLoadEnabledCards(fnLoadCustomCards()));
  const [arrCardOrder, setArrCardOrder] = useState<string[]>(() => fnLoadCardOrder(fnLoadCustomCards()));
  const [mapCardLayout, setMapCardLayout] = useState<Partial<Record<string, ICardRect>>>(fnBuildInitialCardLayout);
  /** 겹침 해소 시 최신 보이는 카드 ID(드래그/리사이즈 콜백에서 사용) */
  const refOrderedVisibleIds = useRef<string[]>([]);
  const strTableSize = fnLoadTableSize();

  const [nDraftX, setNDraftX] = useState(24);
  const [nDraftY, setNDraftY] = useState(24);
  const [nDraftW, setNDraftW] = useState(280);
  const [nDraftH, setNDraftH] = useState(160);

  const [bAddCardOpen, setBAddCardOpen] = useState(false);
  const [nAddCardStep, setNAddCardStep] = useState(0);
  const [strAddCardType, setStrAddCardType] = useState<'number' | 'table' | 'custom' | null>(null);
  const [strAddCardSelectedId, setStrAddCardSelectedId] = useState<TDashboardCardId | null>(null);
  const [arrAddCardSelectedColumnKeys, setArrAddCardSelectedColumnKeys] = useState<string[]>([]);
  const [strCustomTitle, setStrCustomTitle] = useState('');
  const [arrCustomFormRows, setArrCustomFormRows] = useState<{ strLabel: string; strMetricId: string }[]>([]);
  const [arrCustomFormGroups, setArrCustomFormGroups] = useState<ICustomDashboardEventGroupFormRow[]>([]);
  /** 맞춤 카드 Collapse 열린 패널(제어 컴포넌트 — 카드 호버로 리마운트되지 않음) */
  const [mapCustomCollapseKeys, setMapCustomCollapseKeys] = useState<Record<string, string[]>>({});
  const fnOpenAddCard = useCallback(() => {
    setNAddCardStep(0);
    setStrAddCardType(null);
    setStrAddCardSelectedId(null);
    setArrAddCardSelectedColumnKeys([]);
    setStrCustomTitle('');
    setArrCustomFormRows([]);
    setArrCustomFormGroups([]);
    let maxBottom = 24;
    for (const strCId of arrEnabledCardIds) {
      const L = mapCardLayout[strCId];
      if (L) maxBottom = Math.max(maxBottom, L.y + L.height + 16);
    }
    setNDraftX(24);
    setNDraftY(maxBottom);
    setNDraftW(280);
    setNDraftH(160);
    setBAddCardOpen(true);
  }, [arrEnabledCardIds, mapCardLayout]);

  const bAddCardIsTable = strAddCardType === 'table';
  const bAddCardIsCustom = strAddCardType === 'custom';
  const arrAddCardStepItems = useMemo(() => {
    if (!strAddCardType) return [{ title: '영역' }, { title: '형태' }];
    if (strAddCardType === 'table') {
      return [
        { title: '영역' },
        { title: '형태' },
        { title: '정보' },
        { title: '컬럼' },
        { title: '생성' },
      ];
    }
    if (strAddCardType === 'custom') {
      return [{ title: '영역' }, { title: '형태' }, { title: '맞춤 구성' }, { title: '생성' }];
    }
    return [{ title: '영역' }, { title: '형태' }, { title: '정보' }, { title: '생성' }];
  }, [strAddCardType]);
  const arrAddCardTableColumns =
    strAddCardSelectedId && (TABLE_CARD_IDS as readonly string[]).includes(strAddCardSelectedId)
      ? OBJ_TABLE_CARD_COLUMNS[strAddCardSelectedId as (typeof TABLE_CARD_IDS)[number]]
      : [];
  const setAddCardTableColumnsToAll = useCallback(() => {
    setArrAddCardSelectedColumnKeys(arrAddCardTableColumns.map((c) => c.key));
  }, [arrAddCardTableColumns]);

  useEffect(() => {
    if (nAddCardStep === 3 && bAddCardIsTable && arrAddCardTableColumns.length > 0 && arrAddCardSelectedColumnKeys.length === 0) {
      setArrAddCardSelectedColumnKeys(arrAddCardTableColumns.map((c) => c.key));
    }
  }, [nAddCardStep, bAddCardIsTable, arrAddCardTableColumns, arrAddCardSelectedColumnKeys.length]);

  const fnRemoveCard = useCallback((strId: string) => {
    if (fnIsCustomDashboardId(strId)) {
      setArrCustomCards((prev) => {
        const next = prev.filter((c) => c.strId !== strId);
        fnSaveCustomCards(next);
        return next;
      });
    }
    setArrEnabledCardIds((prev) => {
      const next = prev.filter((id) => id !== strId);
      fnSaveEnabledCards(next);
      return next;
    });
    setArrCardOrder((prev) => {
      const next = prev.filter((id) => id !== strId);
      fnSaveCardOrder(next);
      return next;
    });
    setMapCardLayout((prev) => {
      if (!(strId in prev)) return prev;
      const next = { ...prev };
      delete next[strId];
      fnSaveCardLayoutMap(next);
      return next;
    });
    setMapCustomCollapseKeys((prev) => {
      if (!(strId in prev)) return prev;
      const next = { ...prev };
      delete next[strId];
      return next;
    });
  }, []);

  const fnRestoreCard = useCallback((strId: TDashboardCardId) => {
    setArrEnabledCardIds((prev) => {
      const next = prev.includes(strId) ? prev : [...prev, strId];
      fnSaveEnabledCards(next);
      return next;
    });
  }, []);

  const fnGetCardLayoutResolved = useCallback(
    (strId: string): ICardRect => {
      const cur = mapCardLayout[strId];
      const defDim = fnDefaultSizeOnly(strId);
      const slot = fnGridSlotByIndex(0);
      if (cur && typeof cur.x === 'number' && typeof cur.y === 'number') {
        return cur;
      }
      return {
        width: cur?.width ?? defDim.width,
        height: cur?.height ?? defDim.height,
        x: cur?.x ?? slot.x,
        y: cur?.y ?? slot.y,
      };
    },
    [mapCardLayout]
  );

  const fnSaveCardDimensions = useCallback((strId: string, nW: number, nH: number) => {
    setMapCardLayout((prev) => {
      const cur = prev[strId];
      const base: ICardRect = cur ?? {
        x: 24,
        y: 24,
        width: nW,
        height: nH,
      };
      let next = { ...prev, [strId]: { ...base, width: nW, height: nH } };
      next = fnApplyOverlapResolveForMovedCard(next, strId, refOrderedVisibleIds.current);
      fnSaveCardLayoutMap(next);
      return next;
    });
  }, []);

  /** 맞춤 카드: 테이블·접기 펼침 후 실제 콘텐츠 높이에 카드 높이 맞춤 */
  const fnReportCustomCardNaturalHeight = useCallback((strId: string, nPixel: number) => {
    setMapCardLayout((prev) => {
      const cur = prev[strId];
      if (!cur) return prev;
      const nR = Math.max(96, Math.ceil(nPixel));
      if (Math.abs(cur.height - nR) < 3) return prev;
      let next = { ...prev, [strId]: { ...cur, height: nR } };
      next = fnApplyOverlapResolveForMovedCard(next, strId, refOrderedVisibleIds.current);
      fnSaveCardLayoutMap(next);
      return next;
    });
  }, []);

  const fnIsCardEnabled = (strId: string) => arrEnabledCardIds.includes(strId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fnHandleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, delta } = event;
    if (!delta || (delta.x === 0 && delta.y === 0)) return;
    const strId = String(active.id);
    setMapCardLayout((prev) => {
      const cur = prev[strId];
      if (!cur) return prev;
      let next = {
        ...prev,
        [strId]: { ...cur, x: cur.x + delta.x, y: cur.y + delta.y },
      };
      next = fnApplyOverlapResolveForMovedCard(next, strId, refOrderedVisibleIds.current);
      fnSaveCardLayoutMap(next);
      return next;
    });
    // 겹침 시 맨 위로 — 순서 끝으로
    setArrCardOrder((prev) => {
      const next = [...prev.filter((id) => id !== strId), strId];
      fnSaveCardOrder(next);
      return next;
    });
  }, []);

  const [nInstances, setNInstances] = useState<number | null>(null);
  const [nInstancesInProgress, setNInstancesInProgress] = useState<number | null>(null);
  const [nInstancesCompleted, setNInstancesCompleted] = useState<number | null>(null);
  const [arrInstanceStatusCounts, setArrInstanceStatusCounts] = useState<Array<{ strStatus: TEventStatus; nCount: number }> | null>(null);
  /** 맞춤 카드 이벤트 그룹·통계용 인스턴스 목록 */
  const [arrDashboardInstances, setArrDashboardInstances] = useState<IEventInstance[]>([]);
  const [nDbConnections, setNDbConnections] = useState<number | null>(null);
  const [nUsers, setNUsers] = useState<number | null>(null);
  const [nRoles, setNRoles] = useState<number | null>(null);
  const [bLoadingStats, setBLoadingStats] = useState(false);

  useEffect(() => {
    fnFetchProducts();
    fnFetchEvents();
  }, [fnFetchProducts, fnFetchEvents]);

  useEffect(() => {
    let bMounted = true;
    setBLoadingStats(true);
    const bLoadInstances =
      fnHas('my_dashboard.view') ||
      arrCustomCards.some((c) => (c.arrEventGroups?.length ?? 0) > 0);
    const fnLoad = async () => {
      const arrPromises: Promise<void>[] = [];
      if (bLoadInstances) {
        arrPromises.push(
          (async () => {
            try {
              const res = await fnApiGetInstances('all');
              if (!bMounted) return;
              const arr: IEventInstance[] = res?.arrInstances ?? [];
              setArrDashboardInstances(arr);
              if (fnHas('my_dashboard.view')) {
                setNInstances(arr.length);
                setNInstancesInProgress(
                  arr.filter((objI) => fnIsInProgress(objI.strStatus)).length
                );
                setNInstancesCompleted(
                  arr.filter((objI) => objI.strStatus === 'live_verified').length
                );
                const statusKeys: TEventStatus[] = [
                  'event_created', 'confirm_requested', 'dba_confirmed',
                  'qa_requested', 'qa_deployed', 'qa_verified',
                  'live_requested', 'live_deployed', 'live_verified',
                ];
                const counts = statusKeys.map((strStatus) => ({
                  strStatus,
                  nCount: arr.filter((objI) => objI.strStatus === strStatus).length,
                }));
                setArrInstanceStatusCounts(counts);
              }
            } catch {
              if (bMounted) {
                setArrDashboardInstances([]);
                setNInstances(0);
              }
            }
          })()
        );
      } else if (bMounted) {
        setArrDashboardInstances([]);
      }
      if (fnHas('db_connection.view') || fnHas('db.manage')) {
        arrPromises.push(
          (async () => {
            try {
              const res = await fnApiGetDbConnections();
              if (bMounted && res?.bSuccess && Array.isArray(res.arrDbConnections))
                setNDbConnections(res.arrDbConnections.length);
            } catch {
              if (bMounted) setNDbConnections(0);
            }
          })()
        );
      }
      if (fnHas('user.view')) {
        arrPromises.push(
          (async () => {
            try {
              const res = await fnApiGetUsers();
              if (bMounted && res?.arrUsers) setNUsers(res.arrUsers.length);
            } catch {
              if (bMounted) setNUsers(0);
            }
          })()
        );
      }
      if (fnHas('role.view')) {
        arrPromises.push(
          (async () => {
            try {
              const res = await fnApiGetRoles();
              if (bMounted && res?.arrRoles) setNRoles(res.arrRoles.length);
            } catch {
              if (bMounted) setNRoles(0);
            }
          })()
        );
      }
      await Promise.all(arrPromises);
      if (bMounted) setBLoadingStats(false);
    };
    fnLoad();
    return () => { bMounted = false; };
  }, [arrPermissions, arrCustomCards]);

  const fnRenderCount = (n: number | null, bAllowed: boolean) => {
    if (!bAllowed) return <span style={{ color: 'var(--ant-color-text-tertiary)' }}>—</span>;
    if (n === null && bLoadingStats) return <span style={{ color: 'var(--ant-color-text-tertiary)' }}>…</span>;
    return n ?? 0;
  };

  const bInstancesAllowed = fnHas('my_dashboard.view');
  const bDbAllowed = fnHas('db_connection.view') || fnHas('db.manage');
  const bUsersAllowed = fnHas('user.view');
  const bRolesAllowed = fnHas('role.view');

  const fnShowCard = (strId: string) => {
    if (!fnIsCardEnabled(strId)) return false;
    if (fnIsCustomDashboardId(strId)) return arrCustomCards.some((c) => c.strId === strId);
    if (fnIsStatusCardId(strId)) return bInstancesAllowed;
    switch (strId) {
      case 'dbConnection': return bDbAllowed;
      case 'user': return bUsersAllowed;
      case 'role': return bRolesAllowed;
      case 'instance':
      case 'instanceInProgress':
      case 'instanceCompleted':
        return bInstancesAllowed;
      default:
        return true;
    }
  };

  const fnGetStatusCount = (strStatus: TEventStatus): number => {
    const found = arrInstanceStatusCounts?.find((c) => c.strStatus === strStatus);
    return found?.nCount ?? 0;
  };

  const fnRenderMetricValue = useCallback(
    (strMetricId: string): React.ReactNode => {
      if (!(NUMBER_CARD_IDS as readonly string[]).includes(strMetricId)) {
        return <span style={{ color: 'var(--ant-color-text-tertiary)' }}>—</span>;
      }
      const id = strMetricId as TDashboardCardId;
      if (fnIsStatusCardId(id)) {
        if (!bInstancesAllowed) return <span style={{ color: 'var(--ant-color-text-tertiary)' }}>—</span>;
        const strSt = id.replace('status_', '') as TEventStatus;
        return <span style={OBJ_CARD_VALUE_STYLE}>{fnGetStatusCount(strSt)}건</span>;
      }
      switch (id) {
        case 'product':
          return <span style={OBJ_CARD_VALUE_STYLE}>{arrProducts.length}개</span>;
        case 'eventTemplate':
          return <span style={OBJ_CARD_VALUE_STYLE}>{arrEvents.length}개</span>;
        case 'instance':
          return (
            <span style={OBJ_CARD_VALUE_STYLE}>
              {fnRenderCount(nInstances, bInstancesAllowed)}
              {bInstancesAllowed ? '건' : ''}
            </span>
          );
        case 'service':
          return (
            <span style={OBJ_CARD_VALUE_STYLE}>
              {arrProducts.reduce((n, p) => n + p.arrServices.length, 0)}개
            </span>
          );
        case 'dbConnection':
          return <span style={OBJ_CARD_VALUE_STYLE}>{fnRenderCount(nDbConnections, true)}개</span>;
        case 'user':
          return <span style={OBJ_CARD_VALUE_STYLE}>{fnRenderCount(nUsers, true)}명</span>;
        case 'role':
          return <span style={OBJ_CARD_VALUE_STYLE}>{fnRenderCount(nRoles, true)}개</span>;
        case 'instanceInProgress':
          return <span style={OBJ_CARD_VALUE_STYLE}>{nInstancesInProgress ?? 0}건</span>;
        case 'instanceCompleted':
          return <span style={OBJ_CARD_VALUE_STYLE}>{nInstancesCompleted ?? 0}건</span>;
        default:
          return <span style={{ color: 'var(--ant-color-text-tertiary)' }}>—</span>;
      }
    },
    [
      arrProducts,
      arrEvents,
      bInstancesAllowed,
      arrInstanceStatusCounts,
      nInstances,
      nInstancesInProgress,
      nInstancesCompleted,
      nDbConnections,
      nUsers,
      nRoles,
      bLoadingStats,
    ]
  );

  const arrProductColumns = [
    { title: '프로젝트명', dataIndex: 'strName', key: 'strName', width: 140 },
    {
      title: '서비스',
      dataIndex: 'arrServices',
      key: 'arrServices',
      render: (arrServices: IService[]) => (
        <Space wrap>
          {arrServices.map((s) => (
            <Tag key={s.strAbbr} color="blue">{s.strAbbr} ({s.strRegion})</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '이벤트 템플릿 수',
      key: 'eventCount',
      width: 120,
      render: (_: unknown, objRecord: IProduct) => {
        const nCount = arrEvents.filter((e) => e.nProductId === objRecord.nId).length;
        return nCount > 0 ? <Tag color="green">{nCount}개</Tag> : <Tag>0개</Tag>;
      },
    },
  ];

  const strDashboardProductsTableId = OBJ_TABLE_CARD_TABLE_IDS.productTable;
  const arrVisibleProductKeys = fnLoadVisibleColumnKeys(strDashboardProductsTableId);
  const arrProductColumnsFiltered =
    arrVisibleProductKeys && arrVisibleProductKeys.length > 0
      ? arrProductColumns.filter((col) => (col.key && arrVisibleProductKeys.includes(col.key)) ?? false)
      : arrProductColumns;

  const arrAvailableIds = DASHBOARD_CARD_IDS.filter((id) => {
    if (fnIsStatusCardId(id)) return bInstancesAllowed;
    switch (id) {
      case 'dbConnection': return bDbAllowed;
      case 'user': return bUsersAllowed;
      case 'role': return bRolesAllowed;
      case 'instance':
      case 'instanceInProgress':
      case 'instanceCompleted':
        return bInstancesAllowed;
      default:
        return true;
    }
  });
  const arrHiddenIds = arrAvailableIds.filter((id) => !arrEnabledCardIds.includes(id));
  const arrHiddenNumberIds = arrHiddenIds.filter((id) => (NUMBER_CARD_IDS as readonly string[]).includes(id));
  const arrHiddenTableIds = arrHiddenIds.filter((id) => (TABLE_CARD_IDS as readonly string[]).includes(id));

  const arrAddCardStep2Options = strAddCardType === 'number' ? arrHiddenNumberIds : strAddCardType === 'table' ? arrHiddenTableIds : [];

  const fnAddCardConfirm = useCallback(() => {
    if (strAddCardSelectedId) {
      fnRestoreCard(strAddCardSelectedId);
      setMapCardLayout((prev) => {
        let next = {
          ...prev,
          [strAddCardSelectedId]: {
            x: nDraftX,
            y: nDraftY,
            width: nDraftW,
            height: nDraftH,
          },
        };
        const arrVis = refOrderedVisibleIds.current.includes(strAddCardSelectedId)
          ? refOrderedVisibleIds.current
          : [...refOrderedVisibleIds.current, strAddCardSelectedId];
        next = fnApplyOverlapResolveForMovedCard(next, strAddCardSelectedId, arrVis);
        fnSaveCardLayoutMap(next);
        return next;
      });
      setArrCardOrder((prev) => {
        if (prev.includes(strAddCardSelectedId)) return prev;
        const next = [...prev, strAddCardSelectedId];
        fnSaveCardOrder(next);
        return next;
      });
      setBAddCardOpen(false);
      setNAddCardStep(0);
      setStrAddCardType(null);
    }
  }, [strAddCardSelectedId, fnRestoreCard, nDraftX, nDraftY, nDraftW, nDraftH]);

  const arrOrderedVisibleIds = useMemo(() => {
    const visible = arrEnabledCardIds.filter((id) => fnShowCard(id));
    return [...visible].sort((a, b) => {
      const ia = arrCardOrder.indexOf(a);
      const ib = arrCardOrder.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, [arrEnabledCardIds, arrCardOrder, arrCustomCards, bInstancesAllowed, bDbAllowed, bUsersAllowed, bRolesAllowed]);
  refOrderedVisibleIds.current = arrOrderedVisibleIds;

  const strVisibleIdsKey = arrOrderedVisibleIds.join('|');
  /** 보이는 카드 집합이 바뀔 때 저장된 좌표끼리 겹침이 있으면 순서대로 밀어 정리 */
  useLayoutEffect(() => {
    if (arrOrderedVisibleIds.length === 0) return;
    setMapCardLayout((prev) => {
      let next = { ...prev };
      let bChanged = false;
      const nPasses = arrOrderedVisibleIds.length + 3;
      for (let nP = 0; nP < nPasses; nP++) {
        for (const strId of arrOrderedVisibleIds) {
          if (!next[strId]) continue;
          const objBefore = next[strId]!;
          const resolved = fnApplyOverlapResolveForMovedCard(next, strId, arrOrderedVisibleIds);
          const objAfter = resolved[strId];
          if (objAfter && (objAfter.x !== objBefore.x || objAfter.y !== objBefore.y)) bChanged = true;
          next = resolved;
        }
      }
      if (!bChanged) return prev;
      fnSaveCardLayoutMap(next);
      return next;
    });
    // 집합 식별은 strVisibleIdsKey만 (배열 레퍼런스 제외)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strVisibleIdsKey]);

  const nCanvasMinHeight = useMemo(() => {
    let maxY = 480;
    for (const strCId of arrOrderedVisibleIds) {
      const L = fnGetCardLayoutResolved(strCId);
      maxY = Math.max(maxY, L.y + L.height + 40);
    }
    return maxY;
  }, [arrOrderedVisibleIds, fnGetCardLayoutResolved]);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>대시보드</Title>
          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            카드는 <b>고정 좌표</b>에 배치됩니다. 추가 시 먼저 영역(위치·크기)을 정한 뒤 속성을 채웁니다.
            일반 카드는 호버 후 아무 곳이나 드래그로 이동, <b>맞춤 카드는 제목 줄만</b> 드래그해 이동합니다.
            모서리로 크기 조절, (−)로 제외. 맞춤 카드는 테이블·접기 펼침에 맞춰 높이가 맞춰집니다.
            카드 영역은 서로 <b>겹치지 않게</b> 자동으로 밀려 납니다(최소 여백 {N_CARD_MIN_GAP}px).
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={fnOpenAddCard}>
          카드 추가
        </Button>
      </div>

      <Modal
        title="카드 추가"
        open={bAddCardOpen}
        onCancel={() => {
          setBAddCardOpen(false);
          setNAddCardStep(0);
          setStrAddCardType(null);
        }}
        footer={null}
        width={620}
        destroyOnClose
      >
        <Steps
          current={nAddCardStep}
          size="small"
          style={{ marginBottom: 20 }}
          items={arrAddCardStepItems}
        />
        {nAddCardStep === 0 && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Text type="secondary">
              캔버스에 둘 <b>고정 영역</b>을 먼저 지정합니다(px). 이후 드래그로 옮길 수 있습니다.
            </Text>
            <Space wrap style={{ width: '100%' }}>
              <span>X</span>
              <InputNumber min={0} max={8000} value={nDraftX} onChange={(v) => setNDraftX(Number(v ?? 0))} />
              <span>Y</span>
              <InputNumber min={0} max={8000} value={nDraftY} onChange={(v) => setNDraftY(Number(v ?? 0))} />
            </Space>
            <Space wrap style={{ width: '100%' }}>
              <span>너비</span>
              <InputNumber min={120} max={2400} value={nDraftW} onChange={(v) => setNDraftW(Number(v ?? 280))} />
              <span>높이</span>
              <InputNumber min={80} max={2000} value={nDraftH} onChange={(v) => setNDraftH(Number(v ?? 160))} />
            </Space>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => setBAddCardOpen(false)}>취소</Button>
              <Button type="primary" onClick={() => setNAddCardStep(1)}>
                다음
              </Button>
            </div>
          </Space>
        )}
        {nAddCardStep === 1 && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Text type="secondary">추가할 카드 형태를 선택하세요.</Text>
            <Space size={12} wrap>
              <Button
                type="default"
                onClick={() => {
                  setStrAddCardType('number');
                  setNAddCardStep(2);
                }}
              >
                숫자 카드
              </Button>
              <Button
                type="default"
                onClick={() => {
                  setStrAddCardType('table');
                  setNAddCardStep(2);
                }}
              >
                테이블 카드
              </Button>
              <Button
                type="default"
                onClick={() => {
                  setStrAddCardType('custom');
                  setNAddCardStep(2);
                }}
              >
                맞춤 카드
              </Button>
            </Space>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <Button onClick={() => setNAddCardStep(0)}>이전</Button>
              <Button onClick={() => setBAddCardOpen(false)}>취소</Button>
            </div>
          </Space>
        )}
        {nAddCardStep === 2 && bAddCardIsCustom && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Text type="secondary">
              <b>숫자 지표 행</b>과/또는 <b>이벤트 그룹</b>을 넣을 수 있습니다. 그룹은 접어서 열 수 있고, 건수·목록(이벤트명·반영일·담당자·상태)이 표시됩니다.
            </Text>
            <Input
              placeholder="카드 제목"
              value={strCustomTitle}
              onChange={(e) => setStrCustomTitle(e.target.value)}
              maxLength={80}
              showCount
            />
            <Text strong style={{ fontSize: 12 }}>숫자 지표(선택)</Text>
            {arrCustomFormRows.map((row, nIdx) => (
              <Space key={nIdx} style={{ width: '100%' }} align="start" wrap>
                <Input
                  placeholder="라벨"
                  value={row.strLabel}
                  onChange={(e) => {
                    const v = e.target.value;
                    setArrCustomFormRows((prev) =>
                      prev.map((r, i) => (i === nIdx ? { ...r, strLabel: v } : r))
                    );
                  }}
                  style={{ minWidth: 120, flex: 1 }}
                />
                <Select
                  style={{ minWidth: 200, flex: 1 }}
                  value={row.strMetricId}
                  options={NUMBER_CARD_IDS.map((mid) => ({
                    value: mid,
                    label: OBJ_CARD_LABELS[mid as TDashboardCardId],
                  }))}
                  onChange={(v) => {
                    setArrCustomFormRows((prev) =>
                      prev.map((r, i) => (i === nIdx ? { ...r, strMetricId: v } : r))
                    );
                  }}
                />
                <Button
                  danger
                  type="text"
                  disabled={arrCustomFormRows.length <= 1 && arrCustomFormGroups.length === 0}
                  onClick={() =>
                    setArrCustomFormRows((prev) => prev.filter((_, i) => i !== nIdx))
                  }
                >
                  행 삭제
                </Button>
              </Space>
            ))}
            <Button
              type="dashed"
              onClick={() =>
                setArrCustomFormRows((prev) => [
                  ...prev,
                  { strLabel: '', strMetricId: NUMBER_CARD_IDS[0] },
                ])
              }
            >
              지표 행 추가
            </Button>
            <Divider style={{ margin: '8px 0' }} />
            <Text strong style={{ fontSize: 12 }}>이벤트 그룹(선택)</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              상태를 고르지 않으면(빈 선택) 상태 조건 없이 필터합니다. 「진행 중만」은 완료(live_verified)를 제외합니다.
              기간을 넣으면 선택한 기준(반영일/생성일)의 <b>날짜</b>가 구간에 포함된 인스턴스만 표시합니다.
            </Text>
            {arrCustomFormGroups.map((objG, nIdx) => (
              <div
                key={nIdx}
                style={{
                  border: '1px solid var(--ant-color-border-secondary)',
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  <Input
                    placeholder="그룹 이름"
                    value={objG.strTitle}
                    onChange={(e) => {
                      const v = e.target.value;
                      setArrCustomFormGroups((prev) =>
                        prev.map((g, i) => (i === nIdx ? { ...g, strTitle: v } : g))
                      );
                    }}
                  />
                  <Select
                    mode="multiple"
                    allowClear
                    placeholder="포함할 상태(비우면 상태 무관)"
                    style={{ width: '100%' }}
                    value={objG.arrStatus}
                    options={ARR_EVENT_STATUSES.map((strSt) => ({
                      value: strSt,
                      label: OBJ_STATUS_CONFIG[strSt].strLabel,
                    }))}
                    onChange={(v) => {
                      setArrCustomFormGroups((prev) =>
                        prev.map((g, i) => (i === nIdx ? { ...g, arrStatus: v as TEventStatus[] } : g))
                      );
                    }}
                  />
                  <Checkbox
                    checked={objG.bInProgressOnly}
                    onChange={(e) => {
                      setArrCustomFormGroups((prev) =>
                        prev.map((g, i) =>
                          i === nIdx ? { ...g, bInProgressOnly: e.target.checked } : g
                        )
                      );
                    }}
                  >
                    진행 중인 이벤트만
                  </Checkbox>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                      기간(선택)
                    </Text>
                    <Select
                      style={{ width: '100%', marginBottom: 8 }}
                      value={objG.strDateBasis}
                      options={[
                        { value: 'deploy', label: '기준: 반영일' },
                        { value: 'created', label: '기준: 생성일' },
                      ]}
                      onChange={(v) => {
                        setArrCustomFormGroups((prev) =>
                          prev.map((g, i) => (i === nIdx ? { ...g, strDateBasis: v } : g))
                        );
                      }}
                    />
                    <DatePicker.RangePicker
                      style={{ width: '100%' }}
                      allowEmpty={[true, true]}
                      allowClear
                      value={[
                        objG.strPeriodStart ? dayjs(objG.strPeriodStart) : null,
                        objG.strPeriodEnd ? dayjs(objG.strPeriodEnd) : null,
                      ]}
                      onChange={(arrDt) => {
                        setArrCustomFormGroups((prev) =>
                          prev.map((g, i) =>
                            i === nIdx
                              ? {
                                  ...g,
                                  strPeriodStart: arrDt?.[0]?.format('YYYY-MM-DD') ?? undefined,
                                  strPeriodEnd: arrDt?.[1]?.format('YYYY-MM-DD') ?? undefined,
                                }
                              : g
                          )
                        );
                      }}
                    />
                    {fnFormatPeriodDaySpan(objG.strPeriodStart, objG.strPeriodEnd) && (
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
                        마지막 날짜 − 시작 날짜:{' '}
                        <b>{fnFormatPeriodDaySpan(objG.strPeriodStart, objG.strPeriodEnd)}</b>
                        {' '}(종료일·시작일 달력 기준 차이)
                      </Text>
                    )}
                  </div>
                  <Button
                    danger
                    type="text"
                    size="small"
                    onClick={() =>
                      setArrCustomFormGroups((prev) => prev.filter((_, i) => i !== nIdx))
                    }
                  >
                    그룹 삭제
                  </Button>
                </Space>
              </div>
            ))}
            <Button
              type="dashed"
              onClick={() =>
                setArrCustomFormGroups((prev) => [...prev, fnDefaultCustomGroupFormRow()])
              }
            >
              그룹 추가
            </Button>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <Button
                onClick={() => {
                  setStrAddCardType(null);
                  setNAddCardStep(1);
                }}
              >
                이전
              </Button>
              <Button
                type="primary"
                disabled={
                  !arrCustomFormRows.some(
                    (r) =>
                      r.strLabel.trim() &&
                      (NUMBER_CARD_IDS as readonly string[]).includes(r.strMetricId)
                  ) && !arrCustomFormGroups.some((g) => g.strTitle.trim())
                }
                onClick={() => setNAddCardStep(3)}
              >
                다음
              </Button>
            </div>
          </Space>
        )}
        {nAddCardStep === 2 && (strAddCardType === 'number' || strAddCardType === 'table') && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Text type="secondary">
              {strAddCardType === 'number' ? '숫자' : '테이블'} 형태로 표시할 정보를 선택하세요.
            </Text>
            {arrAddCardStep2Options.length === 0 ? (
              <Text type="secondary">추가할 수 있는 카드가 없습니다. (이미 모두 표시 중이거나 권한이 없습니다)</Text>
            ) : (
              <Space wrap size={8}>
                {arrAddCardStep2Options.map((strId) => (
                  <Button
                    key={strId}
                    type={strAddCardSelectedId === strId ? 'primary' : 'default'}
                    onClick={() => setStrAddCardSelectedId(strId as TDashboardCardId)}
                  >
                    {OBJ_CARD_LABELS[strId as TDashboardCardId]}
                  </Button>
                ))}
              </Space>
            )}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <Button
                onClick={() => {
                  setStrAddCardType(null);
                  setStrAddCardSelectedId(null);
                  setNAddCardStep(1);
                }}
              >
                이전
              </Button>
              <Button type="primary" disabled={!strAddCardSelectedId} onClick={() => setNAddCardStep(bAddCardIsTable ? 3 : 3)}>
                다음
              </Button>
            </div>
          </Space>
        )}
        {nAddCardStep === 3 && bAddCardIsTable && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Text type="secondary">표시할 컬럼을 선택하세요. (최소 1개)</Text>
            <div>
              <Button type="link" size="small" onClick={setAddCardTableColumnsToAll} style={{ paddingLeft: 0 }}>
                전체 선택
              </Button>
              <Space style={{ marginTop: 8 }} wrap>
                {arrAddCardTableColumns.map((col) => (
                  <Checkbox
                    key={col.key}
                    checked={arrAddCardSelectedColumnKeys.includes(col.key)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setArrAddCardSelectedColumnKeys((prev) => [...prev, col.key]);
                      } else {
                        setArrAddCardSelectedColumnKeys((prev) => prev.filter((k) => k !== col.key));
                      }
                    }}
                  >
                    {col.title}
                  </Checkbox>
                ))}
              </Space>
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <Button onClick={() => setNAddCardStep(2)}>이전</Button>
              <Button
                type="primary"
                disabled={arrAddCardSelectedColumnKeys.length === 0}
                onClick={() => setNAddCardStep(4)}
              >
                다음
              </Button>
            </div>
          </Space>
        )}
        {nAddCardStep === 3 && bAddCardIsCustom && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Text type="secondary">다음 맞춤 카드를 추가합니다.</Text>
            <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
              {strCustomTitle.trim() || '맞춤 카드'}
            </Tag>
            <Text strong style={{ display: 'block', marginTop: 8 }}>지표</Text>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {arrCustomFormRows
                .filter(
                  (r) =>
                    r.strLabel.trim() &&
                    (NUMBER_CARD_IDS as readonly string[]).includes(r.strMetricId)
                )
                .map((r) => (
                  <li key={`${r.strLabel}-${r.strMetricId}`}>
                    <Text>
                      {r.strLabel.trim()} ← {OBJ_CARD_LABELS[r.strMetricId as TDashboardCardId]}
                    </Text>
                  </li>
                ))}
              {arrCustomFormRows.filter(
                (r) =>
                  r.strLabel.trim() &&
                  (NUMBER_CARD_IDS as readonly string[]).includes(r.strMetricId)
              ).length === 0 && <li><Text type="secondary">없음</Text></li>}
            </ul>
            <Text strong style={{ display: 'block', marginTop: 8 }}>이벤트 그룹</Text>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {arrCustomFormGroups
                .filter((g) => g.strTitle.trim())
                .map((g, nGi) => (
                  <li key={`g-${nGi}-${g.strTitle}`}>
                    <Text>
                      {g.strTitle.trim()}
                      {g.bInProgressOnly ? ' · 진행 중만' : ''}
                      {g.arrStatus?.length ? ` · 상태 ${g.arrStatus.length}개` : ' · 상태 전체'}
                      {g.strPeriodStart || g.strPeriodEnd
                        ? ` · ${g.strDateBasis === 'created' ? '생성일' : '반영일'} ${g.strPeriodStart ?? '—'} ~ ${g.strPeriodEnd ?? '—'}${
                            fnFormatPeriodDaySpan(g.strPeriodStart, g.strPeriodEnd)
                              ? ` (차이 ${fnFormatPeriodDaySpan(g.strPeriodStart, g.strPeriodEnd)})`
                              : ''
                          }`
                        : ''}
                    </Text>
                  </li>
                ))}
              {arrCustomFormGroups.filter((g) => g.strTitle.trim()).length === 0 && (
                <li><Text type="secondary">없음</Text></li>
              )}
            </ul>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <Button onClick={() => setNAddCardStep(2)}>이전</Button>
              <Space>
                <Button onClick={() => setBAddCardOpen(false)}>취소</Button>
                <Button
                  type="primary"
                  disabled={
                    !arrCustomFormRows.some(
                      (r) =>
                        r.strLabel.trim() &&
                        (NUMBER_CARD_IDS as readonly string[]).includes(r.strMetricId)
                    ) && !arrCustomFormGroups.some((g) => g.strTitle.trim())
                  }
                  onClick={() => {
                    const arrRows = arrCustomFormRows
                      .filter(
                        (r) =>
                          r.strLabel.trim() &&
                          (NUMBER_CARD_IDS as readonly string[]).includes(r.strMetricId)
                      )
                      .map((r) => ({ strLabel: r.strLabel.trim(), strMetricId: r.strMetricId }));
                    const arrEvGroups: ICustomDashboardEventGroup[] = arrCustomFormGroups
                      .filter((g) => g.strTitle.trim())
                      .map((g) => {
                        const objG: ICustomDashboardEventGroup = {
                          strGroupKey: `grp_${crypto.randomUUID()}`,
                          strTitle: g.strTitle.trim(),
                          arrStatus: g.arrStatus?.length ? g.arrStatus : undefined,
                          bInProgressOnly: g.bInProgressOnly,
                        };
                        const strS = g.strPeriodStart?.trim();
                        const strE = g.strPeriodEnd?.trim();
                        if (strS || strE) {
                          objG.strDateBasis = g.strDateBasis;
                          if (strS) objG.strPeriodStart = strS;
                          if (strE) objG.strPeriodEnd = strE;
                        }
                        return objG;
                      });
                    if (arrRows.length === 0 && arrEvGroups.length === 0) return;
                    const strNewId = fnNewCustomId();
                    const objCard: ICustomEventDashboardCard = {
                      strId: strNewId,
                      strTitle: strCustomTitle.trim() || '맞춤 카드',
                    };
                    if (arrRows.length > 0) objCard.arrRows = arrRows;
                    if (arrEvGroups.length > 0) objCard.arrEventGroups = arrEvGroups;
                    setArrCustomCards((prev) => {
                      const next = [...prev, objCard];
                      fnSaveCustomCards(next);
                      return next;
                    });
                    setArrEnabledCardIds((prev) => {
                      const next = prev.includes(strNewId) ? prev : [...prev, strNewId];
                      fnSaveEnabledCards(next);
                      return next;
                    });
                    setMapCardLayout((prev) => {
                      let next = {
                        ...prev,
                        [strNewId]: {
                          x: nDraftX,
                          y: nDraftY,
                          width: nDraftW,
                          height: nDraftH,
                        },
                      };
                      const arrVis = refOrderedVisibleIds.current.includes(strNewId)
                        ? refOrderedVisibleIds.current
                        : [...refOrderedVisibleIds.current, strNewId];
                      next = fnApplyOverlapResolveForMovedCard(next, strNewId, arrVis);
                      fnSaveCardLayoutMap(next);
                      return next;
                    });
                    setArrCardOrder((prev) => {
                      const next = prev.includes(strNewId) ? prev : [...prev, strNewId];
                      fnSaveCardOrder(next);
                      return next;
                    });
                    setBAddCardOpen(false);
                    setNAddCardStep(0);
                    setStrAddCardType(null);
                  }}
                >
                  추가
                </Button>
              </Space>
            </div>
          </Space>
        )}
        {nAddCardStep === 3 && strAddCardType === 'number' && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Text type="secondary">다음 카드를 대시보드에 추가합니다.</Text>
            {strAddCardSelectedId && (
              <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
                {OBJ_CARD_LABELS[strAddCardSelectedId]}
              </Tag>
            )}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <Button onClick={() => setNAddCardStep(2)}>이전</Button>
              <Space>
                <Button onClick={() => setBAddCardOpen(false)}>취소</Button>
                <Button type="primary" disabled={!strAddCardSelectedId} onClick={fnAddCardConfirm}>
                  추가
                </Button>
              </Space>
            </div>
          </Space>
        )}
        {nAddCardStep === 4 && bAddCardIsTable && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Text type="secondary">다음 카드를 대시보드에 추가합니다.</Text>
            {strAddCardSelectedId && (
              <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
                {OBJ_CARD_LABELS[strAddCardSelectedId]}
              </Tag>
            )}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <Button onClick={() => setNAddCardStep(3)}>이전</Button>
              <Space>
                <Button onClick={() => setBAddCardOpen(false)}>취소</Button>
                <Button
                  type="primary"
                  disabled={!strAddCardSelectedId || arrAddCardSelectedColumnKeys.length === 0}
                  onClick={() => {
                    if (strAddCardSelectedId && (TABLE_CARD_IDS as readonly string[]).includes(strAddCardSelectedId)) {
                      const strTableId = OBJ_TABLE_CARD_TABLE_IDS[strAddCardSelectedId as (typeof TABLE_CARD_IDS)[number]];
                      fnSaveVisibleColumnKeys(strTableId, arrAddCardSelectedColumnKeys);
                    }
                    fnAddCardConfirm();
                  }}
                >
                  추가
                </Button>
              </Space>
            </div>
          </Space>
        )}
      </Modal>

      <DndContext sensors={sensors} onDragEnd={fnHandleDragEnd}>
        <div
          style={{
            position: 'relative',
            minWidth: '100%',
            minHeight: nCanvasMinHeight,
            touchAction: 'none',
          }}
        >
          {arrOrderedVisibleIds.map((strId) => {
            const objLayout = fnGetCardLayoutResolved(strId);
            const nOrd = arrCardOrder.indexOf(strId);
            const nZ = 10 + (nOrd >= 0 ? nOrd : 0);
            const bCustomCard = fnIsCustomDashboardId(strId);
            return (
              <AbsoluteDraggableCardWrapper
                key={strId}
                strCardId={strId}
                objLayout={objLayout}
                nZIndex={nZ}
                onResizeStop={(w, h) => fnSaveCardDimensions(strId, w, h)}
                onRemove={() => fnRemoveCard(strId)}
                bCompact={strId === 'instanceInProgress' || strId === 'instanceCompleted' || fnIsStatusCardId(strId)}
                bDragFromTitleOnly={bCustomCard}
                fnReportNaturalHeight={
                  bCustomCard ? (nH) => fnReportCustomCardNaturalHeight(strId, nH) : undefined
                }
              >
                {strId === 'product' && (
                  <DashboardCardContent
                    icon={fnDashboardCardIcon(AppstoreOutlined, '#667eea')}
                    title="프로덕트"
                  >
                    <span style={OBJ_CARD_VALUE_STYLE}>{arrProducts.length}개</span>
                  </DashboardCardContent>
                )}
                {strId === 'eventTemplate' && (
                  <DashboardCardContent
                    icon={fnDashboardCardIcon(CalendarOutlined, '#52c41a')}
                    title="이벤트 템플릿"
                  >
                    <span style={OBJ_CARD_VALUE_STYLE}>{arrEvents.length}개</span>
                  </DashboardCardContent>
                )}
                {strId === 'instance' && (
                  <DashboardCardContent
                    icon={fnDashboardCardIcon(CodeOutlined, '#faad14')}
                    title="이벤트 인스턴스"
                  >
                    <span style={OBJ_CARD_VALUE_STYLE}>
                      {fnRenderCount(nInstances, bInstancesAllowed)}{bInstancesAllowed ? '건' : ''}
                    </span>
                  </DashboardCardContent>
                )}
                {strId === 'service' && (
                  <DashboardCardContent
                    icon={fnDashboardCardIcon(TeamOutlined, '#eb2f96')}
                    title="서비스(국내/해외)"
                  >
                    <span style={OBJ_CARD_VALUE_STYLE}>
                      {arrProducts.reduce((n, p) => n + p.arrServices.length, 0)}개
                    </span>
                  </DashboardCardContent>
                )}
                {strId === 'dbConnection' && (
                  <DashboardCardContent
                    icon={fnDashboardCardIcon(DatabaseOutlined, '#13c2c2')}
                    title="DB 접속"
                  >
                    <span style={OBJ_CARD_VALUE_STYLE}>{fnRenderCount(nDbConnections, true)}개</span>
                  </DashboardCardContent>
                )}
                {strId === 'user' && (
                  <DashboardCardContent
                    icon={fnDashboardCardIcon(TeamOutlined, '#722ed1')}
                    title="사용자"
                  >
                    <span style={OBJ_CARD_VALUE_STYLE}>{fnRenderCount(nUsers, true)}명</span>
                  </DashboardCardContent>
                )}
                {strId === 'role' && (
                  <DashboardCardContent
                    icon={fnDashboardCardIcon(SafetyCertificateOutlined, '#eb2f96')}
                    title="역할"
                  >
                    <span style={OBJ_CARD_VALUE_STYLE}>{fnRenderCount(nRoles, true)}개</span>
                  </DashboardCardContent>
                )}
                {strId === 'instanceInProgress' && (
                  <DashboardCardContent
                    icon={fnDashboardCardIcon(RocketOutlined, '#1890ff')}
                    title="진행 중"
                  >
                    <span style={OBJ_CARD_VALUE_STYLE}>{nInstancesInProgress ?? 0}건</span>
                  </DashboardCardContent>
                )}
                {strId === 'instanceCompleted' && (
                  <DashboardCardContent
                    icon={fnDashboardCardIcon(CheckCircleOutlined, '#52c41a')}
                    title="완료"
                  >
                    <span style={OBJ_CARD_VALUE_STYLE}>{nInstancesCompleted ?? 0}건</span>
                  </DashboardCardContent>
                )}
                {fnIsStatusCardId(strId) && (() => {
                  const strStatus = strId.replace('status_', '') as TEventStatus;
                  return (
                    <DashboardCardContent
                      icon={fnRenderStatusIcon(strStatus, N_DASHBOARD_ICON_SIZE)}
                      title={OBJ_STATUS_CONFIG[strStatus].strLabel}
                    >
                      <span style={OBJ_CARD_VALUE_STYLE}>{fnGetStatusCount(strStatus)}건</span>
                    </DashboardCardContent>
                  );
                })()}
                {strId === 'productTable' && (
                  <DashboardCardContent
                    icon={fnDashboardCardIcon(DashboardOutlined, '#1890ff')}
                    title="프로덕트 현황"
                    bContentFill
                  >
                    <AppTable
                      strTableId="dashboard_products"
                      dataSource={arrProducts}
                      columns={arrProductColumnsFiltered}
                      pagination={false}
                      size={strTableSize}
                      strEmptyText="등록된 프로덕트가 없습니다."
                    />
                  </DashboardCardContent>
                )}
                {fnIsCustomDashboardId(strId) && (() => {
                  const objC = arrCustomCards.find((c) => c.strId === strId);
                  if (!objC) return null;
                  const arrRowsSafe = objC.arrRows ?? [];
                  const arrGr = objC.arrEventGroups ?? [];
                  const bHasGroups = arrGr.length > 0;
                  const arrDefaultOpen = arrGr.map((g) => g.strGroupKey);
                  const arrActiveCollapse =
                    mapCustomCollapseKeys[strId] ?? arrDefaultOpen;
                  return (
                    <DashboardCardContent
                      icon={fnDashboardCardIcon(DashboardOutlined, '#575ECF')}
                      title={objC.strTitle}
                      bContentFill={false}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          width: '100%',
                        }}
                      >
                        {arrRowsSafe.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {arrRowsSafe.map((row, nR) => (
                              <div
                                key={`${row.strLabel}-${nR}`}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'minmax(72px,36%) 1fr',
                                  gap: 8,
                                  alignItems: 'start',
                                }}
                              >
                                <Text type="secondary">{row.strLabel}</Text>
                                <div style={{ minWidth: 0 }}>{fnRenderMetricValue(row.strMetricId)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {bHasGroups && (
                          <>
                            {arrRowsSafe.length > 0 && <Divider style={{ margin: '4px 0' }} />}
                            {!bInstancesAllowed &&
                            !bLoadingStats &&
                            arrDashboardInstances.length === 0 ? (
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                이벤트 목록·건수는 「나의 대시보드」 보기 권한이 있을 때 조회됩니다.
                              </Text>
                            ) : bLoadingStats && arrDashboardInstances.length === 0 ? (
                              <div style={{ padding: 16, textAlign: 'center' }}>
                                <Spin size="small" />
                              </div>
                            ) : (
                              <Collapse
                                size="small"
                                style={{ width: '100%' }}
                                activeKey={arrActiveCollapse}
                                onChange={(keys) => {
                                  const arr =
                                    keys === undefined
                                      ? []
                                      : Array.isArray(keys)
                                        ? keys
                                        : [keys];
                                  setMapCustomCollapseKeys((prev) => ({
                                    ...prev,
                                    [strId]: arr.map(String),
                                  }));
                                }}
                                items={arrGr.map((objGrp) => {
                                  const arrF = fnFilterInstancesForCustomGroup(
                                    objGrp,
                                    arrDashboardInstances
                                  );
                                  return {
                                    key: objGrp.strGroupKey,
                                    label: (
                                      <Space wrap size={8}>
                                        <span style={{ fontWeight: 600 }}>{objGrp.strTitle}</span>
                                        <Tag color="processing">{arrF.length}건</Tag>
                                        {(objGrp.strPeriodStart || objGrp.strPeriodEnd) && (
                                          <Tag>
                                            {(objGrp.strDateBasis ?? 'deploy') === 'deploy'
                                              ? '반영일'
                                              : '생성일'}{' '}
                                            {objGrp.strPeriodStart ?? '—'} ~ {objGrp.strPeriodEnd ?? '—'}
                                            {fnFormatPeriodDaySpan(
                                              objGrp.strPeriodStart,
                                              objGrp.strPeriodEnd
                                            )
                                              ? ` · ${fnFormatPeriodDaySpan(
                                                  objGrp.strPeriodStart,
                                                  objGrp.strPeriodEnd
                                                )}`
                                              : ''}
                                          </Tag>
                                        )}
                                      </Space>
                                    ),
                                    children: (
                                      <Table<IEventInstance>
                                        size="small"
                                        rowKey="nId"
                                        dataSource={arrF}
                                        pagination={arrF.length > 10 ? { pageSize: 10 } : false}
                                        scroll={
                                          arrF.length > 5 ? { x: 'max-content' } : undefined
                                        }
                                        locale={{ emptyText: '해당 조건의 이벤트가 없습니다.' }}
                                        columns={[
                                          {
                                            title: '이벤트명',
                                            dataIndex: 'strEventName',
                                            ellipsis: true,
                                          },
                                          {
                                            title: '반영일',
                                            dataIndex: 'dtDeployDate',
                                            width: 140,
                                            render: (v: string) =>
                                              v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—',
                                          },
                                          {
                                            title: '담당자',
                                            key: 'assignee',
                                            width: 100,
                                            ellipsis: true,
                                            render: (_: unknown, r: IEventInstance) =>
                                              r.strCreatedBy ||
                                              r.objCreator?.strDisplayName ||
                                              '—',
                                          },
                                          {
                                            title: '상태',
                                            dataIndex: 'strStatus',
                                            width: 110,
                                            render: (strSt: TEventStatus) => (
                                              <Tag color={OBJ_STATUS_CONFIG[strSt].strColor}>
                                                {OBJ_STATUS_CONFIG[strSt].strLabel}
                                              </Tag>
                                            ),
                                          },
                                        ]}
                                      />
                                    ),
                                  };
                                })}
                              />
                            )}
                          </>
                        )}
                      </div>
                    </DashboardCardContent>
                  );
                })()}
              </AbsoluteDraggableCardWrapper>
            );
          })}
        </div>
      </DndContext>
    </>
  );
};

export default DashboardPage;
