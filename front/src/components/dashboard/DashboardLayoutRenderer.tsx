import React, { useMemo } from 'react';
import {
  Row, Col, Card, Statistic, Tag, Space, Table, Typography, Progress, Empty, Spin,
} from 'antd';
import {
  ClockCircleOutlined, SyncOutlined, RocketOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { IEventInstance, TEventStatus } from '../../types';
import { OBJ_STATUS_CONFIG } from '../../types';
import { fnRenderStatusIcon } from '../../constants/statusIcons';
import type { IDashboardLayoutRoot, IDashboardWidget, IInstanceListWidgetOptions, IKpiStatOptions, IProductSummaryOptions, IStatusSummaryOptions } from '../../types/dashboardLayout';
import {
  fnApplyDashboardFilter,
  fnCountMyActionPending,
} from '../../utils/dashboardFilterEngine';
import { InstanceCardLabelRows } from '../InstanceCardLabelRows';
import { fnGetInstanceValueByPath } from '../../utils/dashboardInstanceField';

const { Text, Paragraph } = Typography;

function fnWidgetFiltered(
  objLayout: IDashboardLayoutRoot,
  objW: IDashboardWidget,
  arrAllInstances: IEventInstance[],
  nUserId: number,
  arrPermissions: string[]
): IEventInstance[] {
  return fnApplyDashboardFilter(
    arrAllInstances,
    objW.objFilter,
    objLayout.arrProductGroups,
    { nUserId, arrPermissions }
  );
}

function WidgetKpiStat({
  strKpi,
  arrAllInstances,
  arrPermissions,
  strTitle,
}: {
  strKpi: IKpiStatOptions['strKpi'];
  arrAllInstances: IEventInstance[];
  arrPermissions: string[];
  strTitle?: string;
}) {
  const nTotal = arrAllInstances.length;
  const nMyAction = fnCountMyActionPending(arrAllInstances, arrPermissions);
  const nInProgress = arrAllInstances.filter((e) => e.strStatus !== 'live_verified').length;
  const nCompleted = arrAllInstances.filter((e) => e.strStatus === 'live_verified').length;

  const mapMeta: Record<
    IKpiStatOptions['strKpi'],
    { title: string; value: number; prefix?: React.ReactNode; valueStyle?: React.CSSProperties }
  > = {
    total: { title: strTitle ?? '전체', value: nTotal, prefix: <ClockCircleOutlined /> },
    my_action: {
      title: strTitle ?? '내 처리 대기',
      value: nMyAction,
      prefix: <SyncOutlined />,
      valueStyle: { color: '#faad14' },
    },
    in_progress: {
      title: strTitle ?? '진행 중',
      value: nInProgress,
      prefix: <RocketOutlined />,
      valueStyle: { color: '#1890ff' },
    },
    completed: {
      title: strTitle ?? '완료',
      value: nCompleted,
      prefix: <CheckCircleOutlined />,
      valueStyle: { color: '#52c41a' },
    },
  };
  const meta = mapMeta[strKpi];
  return (
    <Card size="small">
      <Statistic
        title={meta.title}
        value={meta.value}
        suffix="건"
        prefix={meta.prefix}
        valueStyle={meta.valueStyle}
      />
    </Card>
  );
}

function WidgetStatusSummary({
  arrFiltered,
  objOptions,
  strTitle,
}: {
  arrFiltered: IEventInstance[];
  objOptions?: Record<string, unknown>;
  strTitle?: string;
}) {
  const strDisplay = (objOptions?.strDisplay as string) ?? 'chips';
  const bShowZero = Boolean(objOptions?.bShowZero);
  const mapCount = new Map<string, number>();
  for (const e of arrFiltered) {
    mapCount.set(e.strStatus, (mapCount.get(e.strStatus) ?? 0) + 1);
  }
  const arrStatuses = Object.keys(OBJ_STATUS_CONFIG) as TEventStatus[];
  const arrItems = arrStatuses
    .map((strSt) => ({ strStatus: strSt, n: mapCount.get(strSt) ?? 0 }))
    .filter((x) => bShowZero || x.n > 0);

  if (strDisplay === 'chips') {
    return (
      <Card size="small" title={strTitle ?? '상태별 건수'}>
        {arrItems.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="표시할 상태 없음" />
        ) : (
          <Space wrap size={[8, 8]}>
            {arrItems.map(({ strStatus, n }) => (
              <Tag key={strStatus} color={OBJ_STATUS_CONFIG[strStatus].strColor} style={{ margin: 0 }}>
                <Space size={4}>
                  {fnRenderStatusIcon(strStatus, 12)}
                  {OBJ_STATUS_CONFIG[strStatus].strLabel}: {n}
                </Space>
              </Tag>
            ))}
          </Space>
        )}
      </Card>
    );
  }

  return (
    <Card size="small" title={strTitle ?? '상태별 건수'}>
      <Space direction="vertical" style={{ width: '100%' }}>
        {arrItems.map(({ strStatus, n }) => (
          <div key={strStatus}>
            <Text type="secondary">
              <Space size={4}>
                {fnRenderStatusIcon(strStatus, 12)}
                {OBJ_STATUS_CONFIG[strStatus].strLabel}
              </Space>
            </Text>
            <Progress percent={arrFiltered.length ? Math.round((n / arrFiltered.length) * 100) : 0} size="small" format={() => `${n}건`} />
          </div>
        ))}
      </Space>
    </Card>
  );
}

function WidgetProductSummary({
  arrFiltered,
  objLayout,
  objOptions,
  strTitle,
}: {
  arrFiltered: IEventInstance[];
  objLayout: IDashboardLayoutRoot;
  objOptions?: Record<string, unknown>;
  strTitle?: string;
}) {
  const opt = objOptions as IProductSummaryOptions | undefined;
  const strGroupBy = opt?.strGroupBy ?? 'product';
  const mapCount = new Map<string, number>();

  if (strGroupBy === 'group' && objLayout.arrProductGroups?.length) {
    for (const e of arrFiltered) {
      const objG = objLayout.arrProductGroups.find((g) => g.arrProductIds.includes(e.nProductId));
      const strLabel = objG?.strLabel ?? `기타 (${e.strProductName})`;
      mapCount.set(strLabel, (mapCount.get(strLabel) ?? 0) + 1);
    }
  } else {
    for (const e of arrFiltered) {
      const strKey = `${e.strProductName} (${e.strServiceAbbr})`;
      mapCount.set(strKey, (mapCount.get(strKey) ?? 0) + 1);
    }
  }

  const arrEntries = [...mapCount.entries()].sort((a, b) => b[1] - a[1]);
  const nMax = arrEntries[0]?.[1] ?? 1;

  return (
    <Card size="small" title={strTitle ?? '프로덕트별 건수'}>
      {arrEntries.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="데이터 없음" />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          {arrEntries.map(([strLabel, n]) => (
            <div key={strLabel}>
              <Text ellipsis style={{ maxWidth: '40%', display: 'inline-block', verticalAlign: 'middle' }}>
                {strLabel}
              </Text>
              <Progress style={{ width: '58%', marginLeft: '2%' }} percent={Math.round((n / nMax) * 100)} size="small" format={() => `${n}건`} />
            </div>
          ))}
        </Space>
      )}
    </Card>
  );
}

function WidgetActorSummary({ arrFiltered, strTitle }: { arrFiltered: IEventInstance[]; strTitle?: string }) {
  const mapCount = new Map<string, number>();
  for (const e of arrFiltered) {
    const strBy = e.strCreatedBy || '(미상)';
    mapCount.set(strBy, (mapCount.get(strBy) ?? 0) + 1);
  }
  const arrEntries = [...mapCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  return (
    <Card size="small" title={strTitle ?? '생성자별 건수'}>
      <Space wrap size={[8, 8]}>
        {arrEntries.map(([strName, n]) => (
          <Tag key={strName}>
            {strName}: {n}
          </Tag>
        ))}
      </Space>
    </Card>
  );
}

function WidgetDeployCalendar({ arrFiltered, strTitle }: { arrFiltered: IEventInstance[]; strTitle?: string }) {
  const dtMonth = dayjs().startOf('month');
  const arrInMonth = arrFiltered.filter((e) => dayjs(e.dtDeployDate).isSame(dtMonth, 'month'));
  const mapDay = new Map<string, IEventInstance[]>();
  for (const e of arrInMonth) {
    const strKey = dayjs(e.dtDeployDate).format('YYYY-MM-DD');
    const arr = mapDay.get(strKey) ?? [];
    arr.push(e);
    mapDay.set(strKey, arr);
  }
  const arrRows = [...mapDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([strDay, arr]) => ({
      strDay,
      n: arr.length,
      strSample: arr[0]?.strEventName ?? '',
    }));

  return (
    <Card size="small" title={strTitle ?? '배포 일정'} extra={<Text type="secondary">{dtMonth.format('YYYY년 M월')}</Text>}>
      {arrRows.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="이번 달 배포 일정 없음" />
      ) : (
        <Table
          size="small"
          pagination={false}
          rowKey="strDay"
          dataSource={arrRows}
          columns={[
            { title: '날짜', dataIndex: 'strDay', width: 110 },
            { title: '건수', dataIndex: 'n', width: 56 },
            { title: '예시', dataIndex: 'strSample', ellipsis: true },
          ]}
        />
      )}
    </Card>
  );
}

function WidgetInstanceList({
  arrFiltered,
  objOptions,
  strTitle,
}: {
  arrFiltered: IEventInstance[];
  objOptions?: Record<string, unknown>;
  strTitle?: string;
}) {
  const opt = objOptions as IInstanceListWidgetOptions | undefined;
  const strView = opt?.strView ?? 'table';
  const nPageSize = opt?.nPageSize ?? 8;

  if (strView === 'card') {
    const arrRows = opt?.arrCardRows?.length ? opt.arrCardRows : [];
    return (
      <Card size="small" title={strTitle ?? '이벤트 목록'}>
        {arrFiltered.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {arrFiltered.slice(0, nPageSize).map((objI) => (
              <Card key={objI.nId} size="small" type="inner" title={<Text strong ellipsis>{objI.strEventName}</Text>}>
                {arrRows.length > 0 ? (
                  <InstanceCardLabelRows
                    objInstance={objI}
                    arrRows={arrRows}
                    strCardInnerLayout={opt?.strCardInnerLayout}
                    nInnerColumns={opt?.nInnerColumns}
                    strInnerGap={opt?.strInnerGap}
                  />
                ) : (
                  <Text type="secondary">arrCardRows 없음</Text>
                )}
              </Card>
            ))}
          </Space>
        )}
      </Card>
    );
  }

  const arrColKeys = opt?.arrColumns?.length
    ? opt.arrColumns
    : ['strEventName', 'strStatus', 'strProductName', 'dtDeployDate'];

  const fnColTitle = (strKey: string) =>
    ({
      strEventName: '이벤트',
      strStatus: '상태',
      strProductName: '프로덕트',
      dtDeployDate: '반영 일시',
      strCreatedBy: '생성자',
    }[strKey] ?? strKey);

  const arrColumns = arrColKeys.map((strDataIndex) => ({
    title: fnColTitle(strDataIndex),
    dataIndex: strDataIndex,
    key: strDataIndex,
    ellipsis: true,
    render: (v: unknown, r: IEventInstance) => {
      if (strDataIndex === 'strStatus' && typeof v === 'string') {
        const s = v as TEventStatus;
        if (!OBJ_STATUS_CONFIG[s]) return v;
        return (
          <Space size={4}>
            {fnRenderStatusIcon(s, 12)}
            <Tag color={OBJ_STATUS_CONFIG[s].strColor}>{OBJ_STATUS_CONFIG[s].strLabel}</Tag>
          </Space>
        );
      }
      if (strDataIndex === 'dtDeployDate' && v) {
        return dayjs(String(v)).format('YYYY-MM-DD HH:mm');
      }
      const objRaw = fnGetInstanceValueByPath(r, strDataIndex);
      if (objRaw == null) return '-';
      return String(objRaw);
    },
  }));

  return (
    <Card size="small" title={strTitle ?? '이벤트 목록'}>
      <Table
        size="small"
        rowKey="nId"
        dataSource={arrFiltered}
        columns={arrColumns}
        pagination={{ pageSize: nPageSize, size: 'small', showSizeChanger: false }}
        locale={{ emptyText: '데이터 없음' }}
      />
    </Card>
  );
}

function WidgetMyActionCount({ arrFiltered, strTitle }: { arrFiltered: IEventInstance[]; strTitle?: string }) {
  return (
    <Card size="small">
      <Statistic title={strTitle ?? '내 처리 대기'} value={arrFiltered.length} suffix="건" prefix={<SyncOutlined />} valueStyle={{ color: '#faad14' }} />
    </Card>
  );
}

function WidgetTextNote({ objOptions, strTitle }: { objOptions?: Record<string, unknown>; strTitle?: string }) {
  const strMd = (objOptions?.strMarkdown as string) ?? '';
  return (
    <Card size="small" title={strTitle ?? '안내'}>
      <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{strMd}</Paragraph>
    </Card>
  );
}

function WidgetPlaceholder({ strTitle }: { strTitle?: string }) {
  return (
    <Card size="small" title={strTitle ?? '예약'}>
      <div style={{ border: '1px dashed #d9d9d9', borderRadius: 8, padding: 24, textAlign: 'center', color: '#999' }}>
        위젯 자리
      </div>
    </Card>
  );
}

function fnRenderOneWidget(
  objLayout: IDashboardLayoutRoot,
  objW: IDashboardWidget,
  arrAllInstances: IEventInstance[],
  nUserId: number,
  arrPermissions: string[]
): React.ReactNode {
  const arrFiltered = fnWidgetFiltered(objLayout, objW, arrAllInstances, nUserId, arrPermissions);
  const strT = objW.strTitle;
  const objOpt = objW.objOptions;

  switch (objW.strWidgetType) {
    case 'kpi_stat': {
      const strKpi = (objOpt as IKpiStatOptions)?.strKpi ?? 'total';
      return (
        <WidgetKpiStat strKpi={strKpi} arrAllInstances={arrAllInstances} arrPermissions={arrPermissions} strTitle={strT} />
      );
    }
    case 'status_summary':
      return (
        <WidgetStatusSummary
          arrFiltered={arrFiltered}
          objOptions={objOpt as IStatusSummaryOptions}
          strTitle={strT}
        />
      );
    case 'product_summary':
      return (
        <WidgetProductSummary
          arrFiltered={arrFiltered}
          objLayout={objLayout}
          objOptions={objOpt as unknown as Record<string, unknown>}
          strTitle={strT}
        />
      );
    case 'actor_summary':
      return <WidgetActorSummary arrFiltered={arrFiltered} strTitle={strT} />;
    case 'deploy_calendar':
      return <WidgetDeployCalendar arrFiltered={arrFiltered} strTitle={strT} />;
    case 'instance_list':
      return <WidgetInstanceList arrFiltered={arrFiltered} objOptions={objOpt} strTitle={strT} />;
    case 'my_action_count':
      return <WidgetMyActionCount arrFiltered={arrFiltered} strTitle={strT} />;
    case 'text_note':
      return <WidgetTextNote objOptions={objOpt} strTitle={strT} />;
    case 'placeholder':
      return <WidgetPlaceholder strTitle={strT} />;
    default:
      return (
        <Card size="small" title={strT ?? objW.strWidgetId}>
          <Text type="warning">미구현 위젯: {objW.strWidgetType}</Text>
        </Card>
      );
  }
}

export interface IDashboardLayoutRendererProps {
  objLayout: IDashboardLayoutRoot;
  arrAllInstances: IEventInstance[];
  nUserId: number;
  arrPermissions: string[];
  bLoading?: boolean;
}

/**
 * arrLayoutRows 기준으로 위젯 배치 (24 그리드). 없으면 arrWidgets 순서대로 한 열.
 */
export function DashboardLayoutRenderer({
  objLayout,
  arrAllInstances,
  nUserId,
  arrPermissions,
  bLoading,
}: IDashboardLayoutRendererProps) {
  const mapWidgets = useMemo(() => {
    const m = new Map<string, IDashboardWidget>();
    objLayout.arrWidgets.forEach((w) => m.set(w.strWidgetId, w));
    return m;
  }, [objLayout.arrWidgets]);

  const arrRowsSorted = useMemo(() => {
    const arr = objLayout.arrLayoutRows ?? [];
    return [...arr].sort((a, b) => a.nOrder - b.nOrder);
  }, [objLayout.arrLayoutRows]);

  if (bLoading && arrAllInstances.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  if (!objLayout.arrLayoutRows?.length) {
    return (
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        {objLayout.arrWidgets.map((w) => (
          <div key={w.strWidgetId}>
            {fnRenderOneWidget(objLayout, w, arrAllInstances, nUserId, arrPermissions)}
          </div>
        ))}
      </Space>
    );
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      {arrRowsSorted.map((objRow) => (
        <Row key={objRow.nOrder} gutter={[16, 16]}>
          {objRow.arrColumnSpans.map((objSpan) => {
            const objW = mapWidgets.get(objSpan.strWidgetId);
            if (!objW) return null;
            return (
              <Col key={objSpan.strWidgetId} xs={24} lg={objSpan.nColSpan}>
                {fnRenderOneWidget(objLayout, objW, arrAllInstances, nUserId, arrPermissions)}
              </Col>
            );
          })}
        </Row>
      ))}
    </Space>
  );
}
