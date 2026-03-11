import { useState, useCallback, useRef } from 'react';
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

// 날짜 포맷 헬퍼 (각 페이지에서 재사용)
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

// ─── 드래그 가능한 헤더 셀 ──────────────────────────────────
interface IDraggableHeaderCellProps extends React.HTMLAttributes<HTMLTableCellElement> {
  'data-drag-id': string;
}

const DraggableHeaderCell = (props: IDraggableHeaderCellProps) => {
  const { token } = antdTheme.useToken();
  const strId = props['data-drag-id'];

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: strId });

  // data-drag-id 는 th 에 넘기지 않음 (DOM warning 방지)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { 'data-drag-id': _dragId, style, ...restProps } = props;

  return (
    <th
      ref={setNodeRef}
      style={{
        ...style,
        transform: CSS.Transform.toString(transform),
        transition,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        opacity: isDragging ? 0.55 : 1,
        background: isDragging ? token.colorPrimaryBg : undefined,
        zIndex: isDragging ? 2 : undefined,
      }}
      {...attributes}
      {...listeners}
      {...restProps}
    />
  );
};

// ─── 컬럼에서 안정적인 key 추출 ─────────────────────────────
function fnGetColKey<T>(col: TableColumnType<T>, nIdx: number): string {
  return String(col.key ?? (col.dataIndex as string) ?? `__col_${nIdx}`);
}

// ─── AppTable Props ──────────────────────────────────────────
interface IAppTableProps<T> extends TableProps<T> {
  strEmptyText?: string;
  // false: 컬럼 드래그 비활성화 (기본 true)
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

  // 컬럼 key 순서를 내부 상태로 관리
  const prevColsRef = useRef(columns);
  const [arrOrder, setArrOrder] = useState<string[]>(() =>
    (columns ?? []).map((col, nIdx) => fnGetColKey(col, nIdx)),
  );

  // columns prop이 교체됐을 때 순서 초기화
  if (prevColsRef.current !== columns) {
    prevColsRef.current = columns;
    const arrNewKeys = (columns ?? []).map((col, nIdx) => fnGetColKey(col, nIdx));
    const bSame =
      arrNewKeys.length === arrOrder.length &&
      arrNewKeys.every((k, i) => k === arrOrder[i]);
    if (!bSame) setArrOrder(arrNewKeys);
  }

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
          .map((col) => ({
            ...(col as TableColumnType<T>),
            // onHeaderCell: 해당 th 에 data-drag-id 를 주입
            onHeaderCell: () => ({ 'data-drag-id': fnGetColKey(col as TableColumnType<T>, 0) }),
          }))
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
      // 5px 이상 이동해야 드래그 시작 (클릭과 구분)
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

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={fnOnDragEnd}>
      <SortableContext items={arrOrder} strategy={horizontalListSortingStrategy}>
        {objTable}
      </SortableContext>
    </DndContext>
  );
}

export default AppTable;
