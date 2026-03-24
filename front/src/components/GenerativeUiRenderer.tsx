import React from 'react';
import { Alert, Card, Space, Statistic, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { IUiSpec, TUiBlock } from '../types/generativeUi';

const { Text } = Typography;

/**
 * Generative UI 렌더러 — strType별 AntD 매핑만 허용(임의 컴포넌트/스크립트 실행 없음).
 * arrSpec은 Zod 등으로 파싱·검증한 뒤 넘기는 것을 권장.
 */
const fnRenderOneBlock = (objBlock: TUiBlock): React.ReactNode => {
  switch (objBlock.strType) {
    case 'statistic':
      return (
        <Card key={objBlock.strBlockId} size="small">
          <Statistic
            title={objBlock.strTitle}
            value={objBlock.strValue}
            suffix={objBlock.strSuffix}
          />
        </Card>
      );

    case 'table': {
      const arrColumns: ColumnsType<Record<string, string | number | boolean | null>> =
        objBlock.arrColumns.map((c) => ({
          title: c.strTitle,
          dataIndex: c.strKey,
          key: c.strKey,
          ellipsis: true,
        }));
      const arrData = objBlock.arrRows.map((row, nIdx) => ({
        ...row,
        key: `${objBlock.strBlockId}-r${nIdx}`,
      }));
      return (
        <Card key={objBlock.strBlockId} size="small" title={objBlock.strTitle || undefined}>
          <Table
            size="small"
            pagination={arrData.length > 8 ? { pageSize: 8 } : false}
            columns={arrColumns}
            dataSource={arrData}
            scroll={{ x: 'max-content' }}
          />
        </Card>
      );
    }

    case 'alert':
      return (
        <Alert
          key={objBlock.strBlockId}
          type={objBlock.strLevel ?? 'info'}
          showIcon
          message={objBlock.strMessage}
        />
      );

    case 'text_plain':
      return (
        <Card key={objBlock.strBlockId} size="small" title={objBlock.strTitle || undefined}>
          <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{objBlock.strBody}</Text>
        </Card>
      );

    default: {
      const _b: never = objBlock;
      void _b;
      return (
        <Alert key="gen-ui-unknown" type="error" message="지원하지 않는 블록 타입입니다." />
      );
    }
  }
};

export interface IGenerativeUiRendererProps {
  objSpec: IUiSpec;
  /** 블록 간 간격 */
  nGap?: number;
}

export const GenerativeUiRenderer: React.FC<IGenerativeUiRendererProps> = ({
  objSpec,
  nGap = 12,
}) => (
  <Space direction="vertical" size={nGap} style={{ width: '100%' }}>
    {objSpec.arrBlocks.map((b) => fnRenderOneBlock(b))}
  </Space>
);
