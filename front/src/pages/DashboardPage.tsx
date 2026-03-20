import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Card, Typography, Tag, Space, Button, theme, Modal, Steps, Checkbox, Input, Select, Segmented, Collapse, Table,
  Divider, Spin,
} from 'antd';
import dayjs from 'dayjs';
import { Resizable } from 're-resizable';
import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove } from '@dnd-kit/sortable';
import { rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AppTable from '../components/AppTable';
import { DashboardCardContent, fnDashboardCardIcon, N_DASHBOARD_ICON_SIZE, N_DASHBOARD_VALUE_FONT_SIZE } from '../components/DashboardCardContent';
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

const fnLoadCardSizes = (): Partial<Record<string, { width: number; height: number }>> => {
  try {
    const str = localStorage.getItem(STORAGE_KEY_SIZES);
    if (!str) return {};
    return JSON.parse(str) as Partial<Record<string, { width: number; height: number }>>;
  } catch {
    return {};
  }
};

const fnSaveCardSizes = (map: Partial<Record<string, { width: number; height: number }>>) => {
  localStorage.setItem(STORAGE_KEY_SIZES, JSON.stringify(map));
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

/** 맞춤 카드 이벤트 그룹 필터 — 삭제 제외·진행·상태 AND */
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
    return true;
  });

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
}

const DashboardCardBox = ({
  strCardId,
  size,
  onResizeStop,
  onRemove,
  children,
  bCompact,
  dragHandleProps,
}: IDashboardCardBoxProps) => {
  const [bHover, setBHover] = useState(false);
  const { token } = theme.useToken();

  const cardContent = bCompact ? (
    <Card size="small" style={{ height: '100%' }}>
      {children}
    </Card>
  ) : (
    <Card hoverable style={{ height: '100%' }}>
      {children}
    </Card>
  );

  const wrapWithDrag = dragHandleProps && bHover;
  const cursorStyle = wrapWithDrag
    ? { cursor: dragHandleProps.isDragging ? 'grabbing' : 'grab' as const }
    : undefined;

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
        onMouseEnter={() => setBHover(true)}
        onMouseLeave={() => setBHover(false)}
        style={{ height: '100%', position: 'relative' }}
      >
        {bHover && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
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
        {wrapWithDrag ? (
          <div
            {...dragHandleProps.listeners}
            {...dragHandleProps.attributes}
            style={{ height: '100%', ...cursorStyle }}
          >
            {cardContent}
          </div>
        ) : (
          cardContent
        )}
      </div>
    </Resizable>
  );
};

// 순서 변경용 래퍼 — 카드 호버 시 카드 영역 드래그로 이동
interface ISortableCardWrapperProps {
  strCardId: string;
  size: { width: number; height: number };
  onResizeStop: (w: number, h: number) => void;
  onRemove: () => void;
  bCompact?: boolean;
  children: React.ReactNode;
}

const SortableCardWrapper = ({
  strCardId,
  size,
  onResizeStop,
  onRemove,
  bCompact,
  children,
}: ISortableCardWrapperProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: strCardId,
  });

  const style: React.CSSProperties = {
    width: size.width,
    height: size.height,
    flexShrink: 0,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <DashboardCardBox
        strCardId={strCardId}
        size={size}
        onResizeStop={onResizeStop}
        onRemove={onRemove}
        bCompact={bCompact}
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
  const [mapCardSizes, setMapCardSizes] = useState<Partial<Record<string, { width: number; height: number }>>>(fnLoadCardSizes);
  const strTableSize = fnLoadTableSize();

  const [bAddCardOpen, setBAddCardOpen] = useState(false);
  const [nAddCardStep, setNAddCardStep] = useState(0);
  const [strAddCardType, setStrAddCardType] = useState<'number' | 'table' | 'custom' | null>(null);
  const [strAddCardSelectedId, setStrAddCardSelectedId] = useState<TDashboardCardId | null>(null);
  const [arrAddCardSelectedColumnKeys, setArrAddCardSelectedColumnKeys] = useState<string[]>([]);
  const [strCustomTitle, setStrCustomTitle] = useState('');
  const [arrCustomFormRows, setArrCustomFormRows] = useState<{ strLabel: string; strMetricId: string }[]>([]);
  const [arrCustomFormGroups, setArrCustomFormGroups] = useState<
    { strTitle: string; arrStatus: TEventStatus[]; bInProgressOnly: boolean }[]
  >([]);
  const [strCustomInsertMode, setStrCustomInsertMode] = useState<'first' | 'last' | 'after'>('last');
  const [strCustomInsertAfterId, setStrCustomInsertAfterId] = useState<string | null>(null);

  const fnOpenAddCard = useCallback(() => {
    setNAddCardStep(0);
    setStrAddCardType(null);
    setStrAddCardSelectedId(null);
    setArrAddCardSelectedColumnKeys([]);
    setStrCustomTitle('');
    setArrCustomFormRows([]);
    setArrCustomFormGroups([]);
    setStrCustomInsertMode('last');
    setStrCustomInsertAfterId(null);
    setBAddCardOpen(true);
  }, []);

  const bAddCardIsTable = strAddCardType === 'table';
  const bAddCardIsCustom = strAddCardType === 'custom';
  const nAddCardLastStep = bAddCardIsTable ? 3 : bAddCardIsCustom ? 2 : 2;
  const arrAddCardStepItems = useMemo(
    () => {
      if (bAddCardIsTable) {
        return [{ title: '형태 선택' }, { title: '정보 선택' }, { title: '컬럼 선택' }, { title: '생성' }];
      }
      if (bAddCardIsCustom) {
        return [{ title: '형태 선택' }, { title: '맞춤 구성' }, { title: '생성' }];
      }
      return [{ title: '형태 선택' }, { title: '정보 선택' }, { title: '생성' }];
    },
    [bAddCardIsTable, bAddCardIsCustom],
  );
  const arrAddCardTableColumns =
    strAddCardSelectedId && (TABLE_CARD_IDS as readonly string[]).includes(strAddCardSelectedId)
      ? OBJ_TABLE_CARD_COLUMNS[strAddCardSelectedId as (typeof TABLE_CARD_IDS)[number]]
      : [];
  const setAddCardTableColumnsToAll = useCallback(() => {
    setArrAddCardSelectedColumnKeys(arrAddCardTableColumns.map((c) => c.key));
  }, [arrAddCardTableColumns]);

  useEffect(() => {
    if (nAddCardStep === 2 && bAddCardIsTable && arrAddCardTableColumns.length > 0 && arrAddCardSelectedColumnKeys.length === 0) {
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
    setMapCardSizes((prev) => {
      if (!(strId in prev)) return prev;
      const next = { ...prev };
      delete next[strId];
      fnSaveCardSizes(next);
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

  const fnGetCardSize = useCallback((strId: string) => {
    const saved = mapCardSizes[strId];
    if (saved) return saved;
    if (fnIsCustomDashboardId(strId)) {
      const obj = arrCustomCards.find((c) => c.strId === strId);
      const nMetric = obj?.arrRows?.length ?? 0;
      const nGrp = obj?.arrEventGroups?.length ?? 0;
      const h =
        52 +
        Math.min(nMetric, 14) * 34 +
        (nGrp > 0 ? Math.min(120 + nGrp * 40, 320) : 0);
      return { width: nGrp > 0 ? Math.max(360, 320) : 300, height: Math.min(Math.max(h, 120), 520) };
    }
    return DEFAULT_SIZES[strId as TDashboardCardId];
  }, [mapCardSizes, arrCustomCards]);

  const fnSaveCardSize = useCallback((strId: string, nW: number, nH: number) => {
    setMapCardSizes((prev) => {
      const next = { ...prev, [strId]: { width: nW, height: nH } };
      fnSaveCardSizes(next);
      return next;
    });
  }, []);

  const fnIsCardEnabled = (strId: string) => arrEnabledCardIds.includes(strId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const refOrderedVisibleIds = useRef<string[]>([]);

  const fnHandleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const arrOrdered = refOrderedVisibleIds.current;
    const nFrom = arrOrdered.indexOf(String(active.id));
    const nTo = arrOrdered.indexOf(String(over.id));
    if (nFrom === -1 || nTo === -1) return;
    const arrNewVisible = arrayMove(arrOrdered, nFrom, nTo);
    setArrCardOrder((prev) => {
      const arrRest = prev.filter((id) => !arrOrdered.includes(id));
      const next = [...arrNewVisible, ...arrRest];
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
      setBAddCardOpen(false);
    }
  }, [strAddCardSelectedId, fnRestoreCard]);

  const arrOrderedVisibleIds = useMemo(() => {
    const visible = arrEnabledCardIds.filter((id) => fnShowCard(id));
    return [...visible].sort((a, b) => {
      const ia = arrCardOrder.indexOf(a);
      const ib = arrCardOrder.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, [arrEnabledCardIds, arrCardOrder, arrCustomCards, bInstancesAllowed, bDbAllowed, bUsersAllowed, bRolesAllowed]);
  refOrderedVisibleIds.current = arrOrderedVisibleIds;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>대시보드</Title>
          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            카드 모서리·가장자리 드래그로 크기 조절, 카드에 마우스를 올린 뒤 드래그로 위치 이동, 호버 시 우측 상단 (−) 버튼으로 제외할 수 있습니다.
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={fnOpenAddCard}>
          카드 추가
        </Button>
      </div>

      <Modal
        title="카드 추가"
        open={bAddCardOpen}
        onCancel={() => setBAddCardOpen(false)}
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
            <Text type="secondary">추가할 카드 형태를 선택하세요.</Text>
            <Space size={12} wrap>
              <Button
                type={strAddCardType === 'number' ? 'primary' : 'default'}
                onClick={() => setStrAddCardType('number')}
              >
                숫자 카드
              </Button>
              <Button
                type={strAddCardType === 'table' ? 'primary' : 'default'}
                onClick={() => setStrAddCardType('table')}
              >
                테이블 카드
              </Button>
              <Button
                type={strAddCardType === 'custom' ? 'primary' : 'default'}
                onClick={() => setStrAddCardType('custom')}
              >
                맞춤 카드
              </Button>
            </Space>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => setBAddCardOpen(false)}>취소</Button>
              <Button type="primary" disabled={!strAddCardType} onClick={() => setNAddCardStep(1)}>
                다음
              </Button>
            </div>
          </Space>
        )}
        {nAddCardStep === 1 && bAddCardIsCustom && (
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
                setArrCustomFormGroups((prev) => [
                  ...prev,
                  { strTitle: '', arrStatus: [], bInProgressOnly: true },
                ])
              }
            >
              그룹 추가
            </Button>
            <div>
              <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                생성 시 배치 (이후 카드에서 드래그로 이동 가능)
              </Text>
              <Segmented
                value={strCustomInsertMode}
                onChange={(v) => {
                  setStrCustomInsertMode(v as 'first' | 'last' | 'after');
                  if (v !== 'after') setStrCustomInsertAfterId(null);
                }}
                options={[
                  { label: '맨 앞', value: 'first' },
                  { label: '맨 뒤', value: 'last' },
                  { label: '지정 카드 뒤', value: 'after' },
                ]}
              />
              {strCustomInsertMode === 'after' && (
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  allowClear
                  placeholder="앞에 둘 카드 선택"
                  value={strCustomInsertAfterId ?? undefined}
                  onChange={(v) => setStrCustomInsertAfterId(v ?? null)}
                  options={arrOrderedVisibleIds.map((idOpt) => ({
                    value: idOpt,
                    label: fnIsCustomDashboardId(idOpt)
                      ? arrCustomCards.find((c) => c.strId === idOpt)?.strTitle ?? idOpt
                      : OBJ_CARD_LABELS[idOpt as TDashboardCardId],
                  }))}
                />
              )}
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <Button onClick={() => setNAddCardStep(0)}>이전</Button>
              <Button
                type="primary"
                disabled={
                  !arrCustomFormRows.some(
                    (r) =>
                      r.strLabel.trim() &&
                      (NUMBER_CARD_IDS as readonly string[]).includes(r.strMetricId)
                  ) && !arrCustomFormGroups.some((g) => g.strTitle.trim())
                }
                onClick={() => setNAddCardStep(2)}
              >
                다음
              </Button>
            </div>
          </Space>
        )}
        {nAddCardStep === 1 && !bAddCardIsCustom && (
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
              <Button onClick={() => setNAddCardStep(0)}>이전</Button>
              <Button type="primary" disabled={!strAddCardSelectedId} onClick={() => setNAddCardStep(2)}>
                다음
              </Button>
            </div>
          </Space>
        )}
        {nAddCardStep === 2 && bAddCardIsTable && (
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
              <Button onClick={() => setNAddCardStep(1)}>이전</Button>
              <Button
                type="primary"
                disabled={arrAddCardSelectedColumnKeys.length === 0}
                onClick={() => setNAddCardStep(3)}
              >
                다음
              </Button>
            </div>
          </Space>
        )}
        {nAddCardStep === 2 && bAddCardIsCustom && (
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
                    </Text>
                  </li>
                ))}
              {arrCustomFormGroups.filter((g) => g.strTitle.trim()).length === 0 && (
                <li><Text type="secondary">없음</Text></li>
              )}
            </ul>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <Button onClick={() => setNAddCardStep(1)}>이전</Button>
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
                      .map((g) => ({
                        strGroupKey: `grp_${crypto.randomUUID()}`,
                        strTitle: g.strTitle.trim(),
                        arrStatus: g.arrStatus?.length ? g.arrStatus : undefined,
                        bInProgressOnly: g.bInProgressOnly,
                      }));
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
                    setArrCardOrder((prev) => {
                      let next = prev.filter((id) => id !== strNewId);
                      if (strCustomInsertMode === 'first') next = [strNewId, ...next];
                      else if (strCustomInsertMode === 'last') next = [...next, strNewId];
                      else if (strCustomInsertMode === 'after' && strCustomInsertAfterId) {
                        const nIdx = next.indexOf(strCustomInsertAfterId);
                        if (nIdx === -1) next = [...next, strNewId];
                        else {
                          next = [...next.slice(0, nIdx + 1), strNewId, ...next.slice(nIdx + 1)];
                        }
                      } else next = [...next, strNewId];
                      fnSaveCardOrder(next);
                      return next;
                    });
                    setBAddCardOpen(false);
                    setNAddCardStep(0);
                  }}
                >
                  추가
                </Button>
              </Space>
            </div>
          </Space>
        )}
        {nAddCardStep === 2 && !bAddCardIsTable && !bAddCardIsCustom && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Text type="secondary">다음 카드를 대시보드에 추가합니다.</Text>
            {strAddCardSelectedId && (
              <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
                {OBJ_CARD_LABELS[strAddCardSelectedId]}
              </Tag>
            )}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <Button onClick={() => setNAddCardStep(1)}>이전</Button>
              <Space>
                <Button onClick={() => setBAddCardOpen(false)}>취소</Button>
                <Button type="primary" disabled={!strAddCardSelectedId} onClick={fnAddCardConfirm}>
                  추가
                </Button>
              </Space>
            </div>
          </Space>
        )}
        {nAddCardStep === 3 && bAddCardIsTable && (
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={fnHandleDragEnd}>
        <SortableContext items={arrOrderedVisibleIds} strategy={rectSortingStrategy}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignContent: 'flex-start' }}>
            {arrOrderedVisibleIds.map((strId) => (
              <SortableCardWrapper
                key={strId}
                strCardId={strId}
                size={fnGetCardSize(strId)}
                onResizeStop={(w, h) => fnSaveCardSize(strId, w, h)}
                onRemove={() => fnRemoveCard(strId)}
                bCompact={strId === 'instanceInProgress' || strId === 'instanceCompleted' || fnIsStatusCardId(strId)}
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
                  return (
                    <DashboardCardContent
                      icon={fnDashboardCardIcon(DashboardOutlined, '#575ECF')}
                      title={objC.strTitle}
                      bContentFill={bHasGroups}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          minHeight: 0,
                          flex: bHasGroups ? 1 : undefined,
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
                                style={{ flex: 1, minHeight: 0, overflow: 'auto' }}
                                defaultActiveKey={arrGr.map((objGrp) => objGrp.strGroupKey)}
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
                                      </Space>
                                    ),
                                    children: (
                                      <Table<IEventInstance>
                                        size="small"
                                        rowKey="nId"
                                        dataSource={arrF}
                                        pagination={arrF.length > 10 ? { pageSize: 10 } : false}
                                        scroll={arrF.length > 5 ? { x: 'max-content', y: 200 } : undefined}
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
              </SortableCardWrapper>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </>
  );
};

export default DashboardPage;
