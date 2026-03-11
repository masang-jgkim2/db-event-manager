import { Table, theme as antdTheme } from 'antd';
import type { TableProps, TableColumnType } from 'antd';

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

// AppTable Props - Ant Design TableProps를 그대로 확장
interface IAppTableProps<T> extends TableProps<T> {
  // 기본 emptyText 오버라이드 (기본값: '데이터가 없습니다.')
  strEmptyText?: string;
}

// 공통 테이블 컴포넌트
// - size 기본값: 'small'
// - rowKey 기본값: 'nId'
// - pagination 기본값: pageSize 10
// - locale 기본값: strEmptyText
// - 다크/라이트 테마 토큰 자동 적용
function AppTable<T extends object>({
  strEmptyText = '데이터가 없습니다.',
  size = 'small',
  rowKey = 'nId',
  pagination,
  locale,
  style,
  ...restProps
}: IAppTableProps<T>) {
  const { token } = antdTheme.useToken();

  // pagination 기본값 처리: false 이면 그대로, undefined 이면 pageSize:10 적용
  const objPagination =
    pagination === false
      ? false
      : {
          pageSize: 10,
          showSizeChanger: false,
          showTotal: (nTotal: number) => `총 ${nTotal}건`,
          ...pagination,
        };

  return (
    <Table<T>
      size={size}
      rowKey={rowKey}
      pagination={objPagination}
      locale={{ emptyText: strEmptyText, ...locale }}
      style={{
        // 테마 전환 시 자연스러운 배경 전환
        transition: `background-color 0.2s ease`,
        borderRadius: token.borderRadius,
        ...style,
      }}
      {...restProps}
    />
  );
}

export default AppTable;
