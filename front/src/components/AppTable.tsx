import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
import { CSS } from '@dnd-kit/utilities';

// 컬럼 너비 저장 키
const fnWidthStorageKey = (strTableId: string) => `app_table_col_width_${strTableId}`;
const N_MIN_COL_WIDTH = 40;

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

// localStorage 키 생성
const fnStorageKey = (strTableId: string) => `app_table_col_order_${strTableId}`;

// 저장된 컬럼 순서 로드
const fnLoadOrder = (strTableId: string, arrKeys: string[]): string[] => {
  try {
    const strSaved = localStorage.getItem(fnStorageKey(strTableId));
    if (!strSaved) return arrKeys;
    const arrSaved: string[] = JSON.parse(strSaved);
    // 저장된 순서에 없는 새 컬럼은 뒤에 추가, 삭제된 컬럼은 제거
    const setCurrentKeys = new Set(arrKeys);
    const arrFiltered = arrSaved.filter((k) => setCurrentKeys.has(k));
    const setFilteredKeys = new Set(arrFiltered);
    const arrNew = arrKeys.filter((k) => !setFilteredKeys.has(k));
    return [...arrFiltered, ...arrNew];
  } catch {
    return arrKeys;
  }
};

// 컬럼 순서 저장
const fnSaveOrder = (strTableId: string, arrOrder: string[]): void => {
  try {
    localStorage.setItem(fnStorageKey(strTableId), JSON.stringify(arrOrder));
  } catch {
    // localStorage 사용 불가 시 무시
  }
};

// 저장된 컬럼 너비 로드
const fnLoadWidths = (strTableId: string): Record<string, number> => {
  try {
    const strSaved = localStorage.getItem(fnWidthStorageKey(strTableId));
    if (!strSaved) return {};
    const obj = JSON.parse(strSaved) as Record<string, number>;
    return typeof obj === 'object' && obj !== null ? obj : {};
  } catch {
    return {};
  }
};

// 컬럼 너비 저장
const fnSaveWidths = (strTableId: string, objWidths: Record<string, number>): void => {
  try {
    localStorage.setItem(fnWidthStorageKey(strTableId), JSON.stringify(objWidths));
  } catch {
    // ignore
  }
};

// 리사이즈 콜백 전달용 컨텍스트
interface IResizeContextValue {
  setColWidth: (strColKey: string, nWidth: number) => void;
  strTableId?: string;
}
const ResizeContext = React.createContext<IResizeContextValue | null>(null);

// ─── 드래그(순서) + 리사이즈(너비) 가능한 헤더 셀 ──────────────────────────────────
interface IDraggableHeaderCellProps extends React.HTMLAttributes<HTMLTableCellElement> {
  'data-drag-id': string;
  'data-col-key'?: string;
}

const DraggableHeaderCell = (props: IDraggableHeaderCellProps) => {
  const { token } = antdTheme.useToken();
  const strId = props['data-drag-id'];
  const strColKey = props['data-col-key'];
  const ctxResize = React.useContext(ResizeContext);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: strId });

  const { 'data-drag-id': _dragId, 'data-col-key': _colKey, style, children, ...restProps } = props;
  const nStartXRef = useRef(0);
  const nStartWidthRef = useRef(0);

  const fnHandleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!strColKey || !ctxResize) return;
      const th = (e.target as HTMLElement).closest('th');
      if (!th) return;
      nStartXRef.current = e.clientX;
      nStartWidthRef.current = th.offsetWidth;

      const fnMove = (e2: MouseEvent) => {
        const nDelta = e2.clientX - nStartXRef.current;
        const nNew = Math.max(N_MIN_COL_WIDTH, nStartWidthRef.current + nDelta);
        ctxResize.setColWidth(strColKey, nNew);
      };
      const fnUp = () => {
        document.removeEventListener('mousemove', fnMove);
        document.removeEventListener('mouseup', fnUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', fnMove);
      document.addEventListener('mouseup', fnUp);
    },
    [strColKey, ctxResize],
  );

  const strTransform = transform
    ? CSS.Transform.toString({ ...transform, scaleX: 1, scaleY: 1 })
    : undefined;

  return (
    <th
      ref={setNodeRef}
      style={{
        ...style,
        transform: strTransform,
        transition,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        opacity: isDragging ? 0.55 : 1,
        background: isDragging ? token.colorPrimaryBg : undefined,
        zIndex: isDragging ? 2 : undefined,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        position: 'relative',
      }}
      {...attributes}
      {...listeners}
      {...restProps}
    >
      {children}
      {/* 컬럼 우측 리사이즈 핸들 */}
      {strColKey && ctxResize && (
        <div
          role="presentation"
          onMouseDown={fnHandleResizeMouseDown}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 8,
            height: '100%',
            cursor: 'col-resize',
            zIndex: 1,
          }}
        />
      )}
    </th>
  );
};

// ─── 컬럼에서 안정적인 key 추출 ─────────────────────────────
function fnGetColKey<T>(col: TableColumnType<T>, nIdx: number): string {
  return String(col.key ?? (col.dataIndex as string) ?? `__col_${nIdx}`);
}

// ─── AppTable Props ──────────────────────────────────────────
interface IAppTableProps<T> extends TableProps<T> {
  strEmptyText?: string;
  // 컬럼 드래그 비활성화 (기본 true)
  bDraggableColumns?: boolean;
  // 컬럼 순서 저장용 테이블 ID (미지정 시 저장 안 함)
  strTableId?: string;
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
  strTableId,
  ...restProps
}: IAppTableProps<T>) {
  const { token } = antdTheme.useToken();

  const prevColsRef = useRef(columns);
  const [arrOrder, setArrOrder] = useState<string[]>(() => {
    const arrKeys = (columns ?? []).map((col, nIdx) => fnGetColKey(col, nIdx));
    return strTableId ? fnLoadOrder(strTableId, arrKeys) : arrKeys;
  });

  // 컬럼 너비 (리사이즈 드래그로 변경, strTableId 있으면 localStorage 저장)
  const [objWidths, setObjWidths] = useState<Record<string, number>>(() =>
    strTableId ? fnLoadWidths(strTableId) : {},
  );

  const fnSetColWidth = useCallback(
    (strColKey: string, nWidth: number) => {
      setObjWidths((prev) => {
        const next = { ...prev, [strColKey]: nWidth };
        if (strTableId) fnSaveWidths(strTableId, next);
        return next;
      });
    },
    [strTableId],
  );

  const ctxResizeValue = useMemo<IResizeContextValue | null>(
    () => (bDraggableColumns ? { setColWidth: fnSetColWidth, strTableId } : null),
    [bDraggableColumns, fnSetColWidth, strTableId],
  );

  // columns prop이 교체됐을 때 순서 재계산 (새 컬럼 반영)
  if (prevColsRef.current !== columns) {
    prevColsRef.current = columns;
    const arrNewKeys = (columns ?? []).map((col, nIdx) => fnGetColKey(col, nIdx));
    const bSame =
      arrNewKeys.length === arrOrder.length &&
      arrNewKeys.every((k) => arrOrder.includes(k));
    if (!bSame) {
      const arrMerged = strTableId ? fnLoadOrder(strTableId, arrNewKeys) : arrNewKeys;
      setArrOrder(arrMerged);
    }
  }

  // 드래그 종료 → 순서 업데이트 + 저장
  const fnOnDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setArrOrder((prev) => {
        const nFrom = prev.indexOf(String(active.id));
        const nTo   = prev.indexOf(String(over.id));
        const arrNext = arrayMove(prev, nFrom, nTo);
        if (strTableId) fnSaveOrder(strTableId, arrNext);
        return arrNext;
      });
    },
    [strTableId],
  );

  // strTableId가 뒤늦게 바뀐 경우 저장된 순서 다시 로드
  useEffect(() => {
    if (!strTableId) return;
    const arrKeys = (columns ?? []).map((col, nIdx) => fnGetColKey(col, nIdx));
    setArrOrder(fnLoadOrder(strTableId, arrKeys));
  // columns 변경 감지는 의도적으로 제외 (prevColsRef가 담당)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strTableId]);

  // 현재 순서대로 컬럼 배열 재정렬 + 너비 반영 + onHeaderCell 주입
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
            const colTyped = col as TableColumnType<T>;
            const strColKey = fnGetColKey(colTyped, 0);
            const nWidth = objWidths[strColKey] ?? colTyped.width;
            return {
              ...colTyped,
              width: typeof nWidth === 'number' ? nWidth : colTyped.width,
              onHeaderCell: () => ({
                'data-drag-id': strColKey,
                'data-col-key': strColKey,
              }),
            };
          })
      : (columns as TableColumnType<T>[] | undefined);

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
      components={
        bDraggableColumns
          ? {
              header: {
                cell: DraggableHeaderCell as React.ComponentType<React.HTMLAttributes<HTMLTableCellElement>>,
              },
            }
          : undefined
      }
      {...restProps}
    />
  );

  if (!bDraggableColumns) return objTable;

  const tableContent = (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={fnOnDragEnd}>
      <SortableContext items={arrOrder} strategy={horizontalListSortingStrategy}>
        {objTable}
      </SortableContext>
    </DndContext>
  );

  return (
    <ResizeContext.Provider value={ctxResizeValue!}>
      {tableContent}
    </ResizeContext.Provider>
  );
}

export default AppTable;
