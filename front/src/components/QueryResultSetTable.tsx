import { Table, Typography } from 'antd';
import type { IQueryPartResult } from '../types';

const { Text } = Typography;

interface IProps {
  objPart: IQueryPartResult;
}

const fnFormatCell = (v: unknown) => {
  if (v === null || v === undefined) return <Text type="secondary">NULL</Text>;
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
};

/** 쿼리 실행 결과셋(SELECT 등) — arrResultRows가 있을 때만 표시 */
const QueryResultSetTable = ({ objPart }: IProps) => {
  const arrCols = objPart.arrResultColumns ?? [];
  const arrRows = objPart.arrResultRows ?? [];
  if (arrRows.length === 0 || arrCols.length === 0) return null;

  // dataIndex="" 이면 Ant Design이 행 전체를 넘겨 [object Object] 표시됨
  const arrTableCols = arrCols.map((strCol, nIdx) => {
    const strKey = strCol.trim() ? strCol : `__col_${nIdx}`;
    const strTitle = strCol.trim() ? strCol : '(No column name)';
    return {
      title: strTitle,
      key: strKey,
      ellipsis: true as const,
      render: (_: unknown, record: Record<string, unknown>) =>
        fnFormatCell(
          Object.prototype.hasOwnProperty.call(record, strCol) ? record[strCol] : record[strKey],
        ),
    };
  });

  return (
    <div style={{ marginTop: 8 }}>
      <Table
        size="small"
        bordered={false}
        pagination={arrRows.length > 10 ? { pageSize: 10, size: 'small' } : false}
        scroll={{ x: 'max-content', y: 220 }}
        columns={arrTableCols}
        dataSource={arrRows.map((row, nIdx) => ({ ...row, key: nIdx }))}
      />
      {objPart.bResultTruncated && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          상위 {arrRows.length}행만 표시됩니다. (전체는 DB에서 확인)
        </Text>
      )}
    </div>
  );
};

export default QueryResultSetTable;
