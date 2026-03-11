import { useState, useCallback, useRef, useEffect } from 'react';
import { Table, theme as antdTheme } from 'antd';
import type { TableProps, TableColumnType } from 'antd';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';

// 공통 컬럼 타입 재노출 (각 페이지에서 import 편의)
export type { TableColumnType as TAppColumn };

// 순번(No.) 컬럼 생성 헬퍼
export function fnMakeIndexColumn(nWidth = 55): TableColumnType<unknown> {
  return {
    title: 'No.',
    key: '__index',
    width: nWidth,
    align: 'center' as const,
    render: (_: unknown, __: unknown, nIndex: number) => nIndex + 1,
  };
}

// 날짜 포맷 헬퍼
export function fnFormatDate(strDate?: string | null): string {
  if (!strDate) return '-';
  return new Date(strDate).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── 컬럼에서 안정적인 key 추출 ─────────────────────────────
function fnGetColKey<T>(col: TableColumnType<T>, nIdx: number): string {
  return String(col.key ?? (col.dataIndex as string) ?? `__col_${nIdx}`);
}

// ─── transform에서 translate만 추출 (scale 제거 → 드래그 시 폰트 늘어남 방지) ──
function fnTranslateOnly(transform: { x: number; y: number } | null): string {
  if (!transform) return '';
  return `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`;
}

// ─── 드래그(순서변경) + 리사이즈 헤더 셀 ────────────────────
interface IDragResizeHeaderCellProps extends React.HTMLAttributes<HTMLTableCellElement> {
  'data-drag-id': string;
  'data-col-width'?: number;
  'data-on-resize'?: (nNewWidth: number) => void;
}

const DragResizeHeaderCell = (props: IDragResizeHeaderCellProps) => {
  const { token } = antdTheme.useToken();
  const strId         = props['data-drag-id'];
  const nColWidth     = props['data-col-width'];
  const fnOnResize    = props['data-on-resize'];

  // 리사이즈 핸들 드래그 상태
  const bResizing     = useRef(false);
  const nStartX       = useRef(0);
  const nStartWidth   = useRef(0);
  const [bHoverHandle, setBHoverHandle] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: strId });

  // 글로벌 mousemove / mouseup 등록 (리사이즈 핸들 드래그)
  useEffect(() => {
    const fnMove = (e: MouseEvent) => {
      if (!bResizing.current) return;
      const nDelta = e.clientX - nStartX.current;
      const nNext  = Math.max(40, nStartWidth.current + nDelta);
      fnOnResize?.(nNext);
    };
    const fnUp = () => {
      if (!bResizing.current) return;
      bResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', fnMove);
    window.addEventListener('mouseup', fnUp);
    return () => {
      window.removeEventListener('mousemove', fnMove);
      window.removeEventListener('mouseup', fnUp);
    };
  }, [fnOnResize]);

  const fnResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();   // 순서 드래그 이벤트 전파 차단
    e.preventDefault();
    bResizing.current   = true;
    nStartX.current     = e.clientX;
    nStartWidth.current = nColWidth ?? (e.currentTarget.parentElement?.offsetWidth ?? 100);
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // 불필요한 DOM 속성 제거
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { 'data-drag-id': _id, 'data-col-width': _w, 'data-on-resize': _fn, style, ...restProps } = props;

  return (
    <th
      ref={setNodeRef}
      style={{
        ...style,
        // translate만 적용 (scale 제거 → 폰트 왜곡 방지)
        transform: fnTranslateOnly(transform),
        transition: isDragging ? 'none' : transition,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        opacity: isDragging ? 0.55 : 1,
        background: isDragging ? token.colorPrimaryBg : undefined,
        zIndex: isDragging ? 2 : undefined,
        position: 'relative',
        // 컬럼 너비가 지정된 경우 적용
        ...(nColWidth != null ? { width: nColWidth, minWidth: nColWidth } : {}),
      }}
      {...attributes}
      {...listeners}
      {...restProps}
    >
      {restProps.children}
      {/* 오른쪽 끝 리사이즈 핸들 — 너비 5px, hover 시 강조 */}
      <div
        onMouseDown={fnResizeStart}
        onMouseEnter={() => setBHoverHandle(true)}
        onMouseLeave={() => setBHoverHandle(false)}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 6,
          height: '100%',
          cursor: 'col-resize',
          zIndex: 3,
          background: bHoverHandle
            ? token.colorPrimary + 'aa'
            : 'transparent',
          transition: 'background 0.15s',
        }}
      />
    </th>
  );
};

// ─── AppTable Props ──────────────────────────────────────────
interface IAppTableProps<T> extends TableProps<T> {
  strEmptyText?: string;
  // false: 컬럼 드래그·리사이즈 비활성화 (기본 true)
  bDraggableColumns?: boolean;
}

// ─── 공통 테이블 컴포넌트 ───────────────────────────────────
function AppTable<T extends object>({
  strEmptyText = '데이터가 없습니다.',
  size = 'small',
  rowKey = 'nId',
  pagination,
  locale,
  style,
  columns,
  bDraggableColumns = true,
  ...restProps
}: IAppTableProps<T>) {
  const { token } = antdTheme.useToken();

  // 컬럼 key 순서 상태
  const prevColsRef = useRef(columns);
  const [arrOrder, setArrOrder] = useState<string[]>(() =>
    (columns ?? []).map((col, nIdx) => fnGetColKey(col, nIdx)),
  );

  // 컬럼별 너비 (key → px)
  const [objWidths, setObjWidths] = useState<Record<string, number>>({});

  // columns prop이 교체됐을 때 순서·너비 초기화
  if (prevColsRef.current !== columns) {
    prevColsRef.current = columns;
    const arrNewKeys = (columns ?? []).map((col, nIdx) => fnGetColKey(col, nIdx));
    const bSame =
      arrNewKeys.length === arrOrder.length &&
      arrNewKeys.every((k, i) => k === arrOrder[i]);
    if (!bSame) {
      setArrOrder(arrNewKeys);
      setObjWidths({});
    }
  }

  // 리사이즈 콜백 (key 기반)
  const fnHandleResize = useCallback((strKey: string, nNewWidth: number) => {
    setObjWidths((prev) => ({ ...prev, [strKey]: nNewWidth }));
  }, []);

  // 드래그 종료 → 순서 업데이트
  const fnOnDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setArrOrder((prev) => {
      const nFrom = prev.indexOf(String(active.id));
      const nTo   = prev.indexOf(String(over.id));
      return arrayMove(prev, nFrom, nTo);
    });
  }, []);

  // 현재 순서대로 컬럼 배열 재정렬 + onHeaderCell 주입
  const arrSortedColumns: TableColumnType<T>[] | undefined =
    bDraggableColumns && columns
      ? arrOrder
          .map((strKey) =>
            (columns as TableColumnType<T>[]).find(
              (col, nIdx) => fnGetColKey(col, nIdx) === strKey,
            ),
          )
          .filter(Boolean)
          .map((col) => {
            const strKey = fnGetColKey(col as TableColumnType<T>, 0);
            const nWidth = objWidths[strKey] ?? (col as TableColumnType<T>).width as number | undefined;
            return {
              ...(col as TableColumnType<T>),
              width: nWidth,
              onHeaderCell: () => ({
                'data-drag-id':   strKey,
                'data-col-width': nWidth,
                'data-on-resize': (nW: number) => fnHandleResize(strKey, nW),
              }),
            };
          })
      : (columns as TableColumnType<T>[] | undefined);

  // pagination 기본값 처리
  const objPagination =
    pagination === false
      ? false
      : {
          pageSize: 10,
          showSizeChanger: false,
          showTotal: (nTotal: number) => `총 ${nTotal}건`,
          ...pagination,
        };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 5px 이상 이동해야 드래그 시작 (클릭·리사이즈와 구분)
      activationConstraint: { distance: 5 },
    }),
  );

  const objTable = (
    <Table<T>
      size={size}
      rowKey={rowKey}
      columns={arrSortedColumns}
      pagination={objPagination}
      locale={{ emptyText: strEmptyText, ...locale }}
      style={{
        transition: 'background-color 0.2s ease',
        borderRadius: token.borderRadius,
        ...style,
      }}
      // tableLayout fixed: 리사이즈가 다른 컬럼에 영향 안 주게
      tableLayout={bDraggableColumns ? 'fixed' : undefined}
      components={
        bDraggableColumns
          ? {
              header: {
                cell: DragResizeHeaderCell as React.ComponentType<React.HTMLAttributes<HTMLTableCellElement>>,
              },
            }
          : undefined
      }
      {...restProps}
    />
  );

  if (!bDraggableColumns) return objTable;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={fnOnDragEnd}>
      <SortableContext items={arrOrder} strategy={horizontalListSortingStrategy}>
        {objTable}
      </SortableContext>
    </DndContext>
  );
}

export default AppTable;
