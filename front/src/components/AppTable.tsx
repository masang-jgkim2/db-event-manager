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
const N_MAX_COL_WIDTH = 500;  // 더블클릭 자동 맞춤 시 상한
const N_AUTO_FIT_PADDING = 20;  // 내용물 맞춤 시 여백

export type { TableColumnType as TAppColumn };

/** 좌측 번호 컬럼 — 기본은 서버 PK(`nId`). 없으면 행 순번 폴백 */
export function fnMakeIndexColumn<T extends object = Record<string, unknown>>(
  nWidth: number = 55,
  strPkKey: keyof T = 'nId' as keyof T,
): TableColumnType<T> {
  return {
    title: '번호',
    key: '__index',
    width: nWidth,
    align: 'center' as const,
    dataIndex: strPkKey as TableColumnType<T>['dataIndex'],
    render: (value: unknown, _record: T, nIndex: number) => {
      if (value !== undefined && value !== null && value !== '') {
        return value as React.ReactNode;
      }
      return nIndex + 1;
    },
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

// 번호 컬럼(__index)이 있으면 항상 맨 앞에 두기
const fnEnsureIndexFirst = (arrOrder: string[]): string[] => {
  if (!arrOrder.includes('__index')) return arrOrder;
  return ['__index', ...arrOrder.filter((k) => k !== '__index')];
};

// 저장된 컬럼 순서 로드
const fnLoadOrder = (strTableId: string, arrKeys: string[]): string[] => {
  try {
    const strSaved = localStorage.getItem(fnStorageKey(strTableId));
    if (!strSaved) return fnEnsureIndexFirst(arrKeys);
    const arrSaved: string[] = JSON.parse(strSaved);
    // 저장된 순서에 없는 새 컬럼은 뒤에 추가, 삭제된 컬럼은 제거
    const setCurrentKeys = new Set(arrKeys);
    const arrFiltered = arrSaved.filter((k) => setCurrentKeys.has(k));
    const setFilteredKeys = new Set(arrFiltered);
    const arrNew = arrKeys.filter((k) => !setFilteredKeys.has(k));
    return fnEnsureIndexFirst([...arrFiltered, ...arrNew]);
  } catch {
    return fnEnsureIndexFirst(arrKeys);
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

// colSpan 고려하여 해당 컬럼 인덱스의 셀 반환
function fnGetCellAtColumnIndex(row: HTMLTableRowElement, nColIndex: number): HTMLTableCellElement | null {
  let nCol = 0;
  for (let i = 0; i < row.cells.length; i++) {
    const cell = row.cells[i];
    const nSpan = cell.colSpan || 1;
    if (nColIndex >= nCol && nColIndex < nCol + nSpan) return cell as HTMLTableCellElement;
    nCol += nSpan;
  }
  return null;
}

// 셀 내용의 실제 너비 측정 (레이아웃 너비가 아닌 텍스트/내용 기준)
function fnMeasureCellContentWidth(cell: HTMLTableCellElement): number {
  const div = document.createElement('div');
  const style = window.getComputedStyle(cell);
  div.style.cssText = [
    'position:fixed',
    'left:-9999px',
    'top:0',
    'white-space:nowrap',
    'display:inline-block',
    'font-family:' + (style.fontFamily || 'inherit'),
    'font-size:' + (style.fontSize || 'inherit'),
    'font-weight:' + (style.fontWeight || 'normal'),
    'letter-spacing:' + (style.letterSpacing || 'normal'),
    'padding-left:' + style.paddingLeft,
    'padding-right:' + style.paddingRight,
    'box-sizing:border-box',
  ].join(';');
  div.innerText = cell.innerText?.trim() || '';
  document.body.appendChild(div);
  const w = div.offsetWidth;
  document.body.removeChild(div);
  return w;
}

// ─── 드래그(순서) + 리사이즈(너비) 가능한 헤더 셀 ──────────────────────────────────
// 좌: 리사이즈(인접 왼쪽 컬럼 줄이기) / 중앙: 순서 변경 / 우: 리사이즈(인접 오른쪽 컬럼 줄이기)
interface IDraggableHeaderCellProps extends React.HTMLAttributes<HTMLTableCellElement> {
  'data-drag-id': string;
  'data-col-key'?: string;
  'data-left-col-key'?: string;
  'data-right-col-key'?: string;
}

const DraggableHeaderCell = (props: IDraggableHeaderCellProps) => {
  const { token } = antdTheme.useToken();
  const strId = props['data-drag-id'];
  const strColKey = props['data-col-key'];
  const strLeftColKey = props['data-left-col-key'];
  const strRightColKey = props['data-right-col-key'];
  const ctxResize = React.useContext(ResizeContext);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: strId });

  const { 'data-drag-id': _dragId, 'data-col-key': _colKey, 'data-left-col-key': _leftKey, 'data-right-col-key': _rightKey, style, children, ...restProps } = props;
  const nStartXRef = useRef(0);
  const nStartWidthRef = useRef(0);
  const nStartNeighborWidthRef = useRef(0);
  const nLastAppliedRef = useRef(0);
  const resizeRafRef = useRef<number>(0);
  const resizeTargetRef = useRef<HTMLElement | null>(null);
  const resizePointerIdRef = useRef<number>(-1);

  // 리사이즈: 좌핸들 → 좌드래그 시 왼쪽 인접 컬럼이 줄고 현재 컬럼이 커짐 / 우핸들 → 우드래그 시 오른쪽 인접이 줄고 현재가 커짐
  const fnHandleResizePointerDown = useCallback(
    (e: React.PointerEvent, bLeft: boolean) => {
      e.preventDefault();
      e.stopPropagation();
      if (!strColKey || !ctxResize) return;
      const th = (e.target as HTMLElement).closest('th');
      const table = th?.closest('table');
      if (!th || !table) return;
      const strNeighborKey = bLeft ? strLeftColKey : strRightColKey;
      const neighborTh = strNeighborKey
        ? (table.querySelector(`thead th[data-col-key="${strNeighborKey}"]`) as HTMLTableCellElement | null)
        : null;
      nStartXRef.current = e.clientX;
      nStartWidthRef.current = th.offsetWidth;
      nStartNeighborWidthRef.current = neighborTh?.offsetWidth ?? 0;
      resizeTargetRef.current = e.target as HTMLElement;
      resizePointerIdRef.current = e.pointerId;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

      const fnMove = (e2: PointerEvent) => {
        const nDelta = bLeft ? nStartXRef.current - e2.clientX : e2.clientX - nStartXRef.current;
        let nCurrentNew: number;
        let nNeighborNew: number;
        if (strNeighborKey && neighborTh) {
          // 인접 컬럼과 경계 이동: 인접은 줄고, 현재는 커짐 (합 유지)
          nNeighborNew = Math.max(N_MIN_COL_WIDTH, nStartNeighborWidthRef.current - nDelta);
          nCurrentNew = nStartWidthRef.current + (nStartNeighborWidthRef.current - nNeighborNew);
          if (nCurrentNew < N_MIN_COL_WIDTH) {
            nCurrentNew = N_MIN_COL_WIDTH;
            nNeighborNew = nStartWidthRef.current + nStartNeighborWidthRef.current - N_MIN_COL_WIDTH;
          }
        } else {
          nCurrentNew = Math.max(N_MIN_COL_WIDTH, nStartWidthRef.current + nDelta);
          nNeighborNew = 0;
        }
        if (Math.abs(nCurrentNew - nLastAppliedRef.current) < 2 && !strNeighborKey) return;
        nLastAppliedRef.current = nCurrentNew;
        if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = requestAnimationFrame(() => {
          resizeRafRef.current = 0;
          ctxResize.setColWidth(strColKey, nCurrentNew);
          if (strNeighborKey && nNeighborNew > 0) ctxResize.setColWidth(strNeighborKey, nNeighborNew);
        });
      };
      const fnUp = () => {
        document.removeEventListener('pointermove', fnMove);
        document.removeEventListener('pointerup', fnUp);
        document.removeEventListener('pointercancel', fnUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (resizeRafRef.current) {
          cancelAnimationFrame(resizeRafRef.current);
          resizeRafRef.current = 0;
        }
        if (resizeTargetRef.current && resizePointerIdRef.current >= 0) {
          resizeTargetRef.current.releasePointerCapture?.(resizePointerIdRef.current);
        }
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('pointermove', fnMove);
      document.addEventListener('pointerup', fnUp);
      document.addEventListener('pointercancel', fnUp);
    },
    [strColKey, strLeftColKey, strRightColKey, ctxResize],
  );

  // 더블클릭 시 데이터 행 셀 내용(실제 텍스트/내용 너비) 중 가장 큰 값으로 컬럼 너비 조절
  const fnHandleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!strColKey || !ctxResize) return;
      const th = (e.target as HTMLElement).closest('th');
      const table = th?.closest('table');
      if (!th || !table) return;
      const nColIndex = (th as HTMLTableCellElement).cellIndex;
      let nMaxW = 0;
      const tbody = table.querySelector('tbody');
      if (tbody) {
        tbody.querySelectorAll('tr').forEach((tr) => {
          const td = fnGetCellAtColumnIndex(tr as HTMLTableRowElement, nColIndex);
          if (td) {
            const w = fnMeasureCellContentWidth(td);
            if (w > nMaxW) nMaxW = w;
          }
        });
      }
      const nNew = Math.min(
        N_MAX_COL_WIDTH,
        Math.max(N_MIN_COL_WIDTH, nMaxW + N_AUTO_FIT_PADDING),
      );
      ctxResize.setColWidth(strColKey, nNew);
    },
    [strColKey, ctxResize],
  );

  const strTransform = transform
    ? CSS.Transform.toString({ ...transform, scaleX: 1, scaleY: 1 })
    : undefined;

  return (
    <th
      ref={setNodeRef}
      data-col-key={strColKey}
      style={{
        ...style,
        transform: strTransform,
        transition,
        userSelect: 'none',
        opacity: isDragging ? 0.55 : 1,
        background: isDragging ? token.colorPrimaryBg : undefined,
        zIndex: isDragging ? 2 : undefined,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        position: 'relative',
        padding: 0,
      }}
      {...restProps}
    >
      {/* 좌측: 리사이즈 핸들 — 좌드래그 시 왼쪽 경계(컬럼 너비) 변경 */}
      {strColKey && ctxResize && (
        <div
          role="presentation"
          onPointerDown={(e) => fnHandleResizePointerDown(e, true)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 10,
            height: '100%',
            cursor: 'col-resize',
            zIndex: 1,
          }}
        />
      )}
      {/* 중앙: 순서 변경 드래그 / 더블클릭 시 내용물 맞춤 */}
      <div
        style={{
          marginLeft: 10,
          marginRight: 10,
          padding: '8px 0',
          cursor: isDragging ? 'grabbing' : 'grab',
          minHeight: '100%',
          display: 'flex',
          alignItems: 'center',
        }}
        {...attributes}
        {...listeners}
        onDoubleClick={strColKey && ctxResize ? fnHandleDoubleClick : undefined}
      >
        {children}
      </div>
      {/* 우측: 리사이즈 핸들 — 우드래그 시 우측 경계(컬럼 너비) 변경 */}
      {strColKey && ctxResize && (
        <div
          role="presentation"
          onPointerDown={(e) => fnHandleResizePointerDown(e, false)}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 10,
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
    return strTableId ? fnLoadOrder(strTableId, arrKeys) : fnEnsureIndexFirst(arrKeys);
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

  // 드래그 종료 → 순서 업데이트 + 저장 (번호 컬럼은 항상 맨 앞 유지)
  const fnOnDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setArrOrder((prev) => {
        const nFrom = prev.indexOf(String(active.id));
        const nTo   = prev.indexOf(String(over.id));
        let arrNext = arrayMove(prev, nFrom, nTo);
        arrNext = fnEnsureIndexFirst(arrNext);
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

  // 현재 순서대로 컬럼 배열 재정렬 + 너비 반영 + onHeaderCell 주입 (인접 컬럼 키로 경계 리사이즈)
  const arrSortedColumns: TableColumnType<T>[] | undefined =
    bDraggableColumns && columns
      ? arrOrder
          .map((strKey, nIdx) => {
            const col = (columns as TableColumnType<T>[]).find(
              (c, i) => fnGetColKey(c, i) === strKey,
            ) as TableColumnType<T> | undefined;
            if (!col) return null;
            const strColKey = strKey;
            const strLeftKey = arrOrder[nIdx - 1];
            const strRightKey = arrOrder[nIdx + 1];
            const nWidth = objWidths[strColKey] ?? col.width;
            return {
              ...col,
              width: typeof nWidth === 'number' ? nWidth : col.width,
              onHeaderCell: () => ({
                'data-drag-id': strColKey,
                'data-col-key': strColKey,
                'data-left-col-key': strLeftKey,
                'data-right-col-key': strRightKey,
              }),
            };
          })
          .filter(Boolean) as TableColumnType<T>[]
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
