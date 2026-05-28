import { Table, Typography } from 'antd';
import type { IQueryPartResult } from '../types';

const { Text } = Typography;

interface IProps {
  objPart: IQueryPartResult;
}

/** 쿼리 실행 결과셋(SELECT 등) — arrResultRows가 있을 때만 표시 */
const QueryResultSetTable = ({ objPart }: IProps) => {
  const arrCols = objPart.arrResultColumns ?? [];
  const arrRows = objPart.arrResultRows ?? [];
  if (arrRows.length === 0 || arrCols.length === 0) return null;

  const arrTableCols = arrCols.map((strCol) => ({
    title: strCol,
    dataIndex: strCol,
    key: strCol,
    ellipsis: true,
    render: (v: unknown) => (v === null || v === undefined ? <Text type="secondary">NULL</Text> : String(v)),
  }));

  return (
    <div style={{ marginTop: 8 }}>
      <Table
        size="small"
        bordered
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
