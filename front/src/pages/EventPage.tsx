import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Typography,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Popconfirm,
  message,
  Row,
  Col,
  Tabs,
  Spin,
  Empty,
  theme,
} from 'antd';
import type { FormListFieldData } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import AppTable, { fnMakeIndexColumn } from '../components/AppTable';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined, LinkOutlined, CalendarOutlined,
} from '@ant-design/icons';
import CrudPageShell from '../components/CrudPageShell';
import { ProductNameTag } from '../components/ProductNameTag';
import { DqpmTag } from '../components/DqpmTag';
import { useEventStore } from '../stores/useEventStore';
import { useProductStore } from '../stores/useProductStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useDbConnectionStore } from '../stores/useDbConnectionStore';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import type {
  IEventTemplate, IQueryTemplateItem, IEventInstance, TEventCategory, TEventType, TInputFormat,
  IDbConnection, TPermission, TEventStatus,
} from '../types';
import { ARR_EVENT_CATEGORIES, ARR_EVENT_TYPES, ARR_INPUT_FORMATS, OBJ_STATUS_CONFIG } from '../types';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fnApiGetEventInstancesByTemplate } from '../api/eventApi';
import { fnRenderStatusIcon } from '../constants/statusIcons';
import type { TTagVariant } from '../styles/tagPalette';
import { fnCodeSurfaceStyle, STR_CODE_BLOCK_CLASS } from '../styles/queryEditorTokens';

const { Text } = Typography;
const { TextArea } = Input;

const objCategoryVariant: Record<string, TTagVariant> = {
  '아이템': 'tone4',
  '퀘스트': 'success',
};

const objTypeVariant: Record<string, TTagVariant> = {
  '삭제': 'danger',
  '지급': 'tone3',
  '초기화': 'tone6',
};

// 쿼리 모드: 단일(한 연결 한 쿼리) / 다중(여러 연결·세트)
type TQueryMode = 'single' | 'multi';

const QUERY_TABS_ADD_KEY = '__add__';

// Form.List 렌더 prop 안에서는 훅 호출 불가 → 별도 컴포넌트로 분리
type TQueryTemplatesTabContentProps = {
  fields: FormListFieldData[];
  add: (defaultValue?: unknown, insertIndex?: number) => void;
  remove: (index: number | number[]) => void;
  arrConnectionsByProduct: IDbConnection[];
  activeKey: string;
  setActiveKey: (k: string) => void;
  justAddedRef: React.MutableRefObject<boolean>;
};
const QueryTemplatesTabContent = ({
  fields,
  add,
  remove,
  arrConnectionsByProduct,
  activeKey,
  setActiveKey,
  justAddedRef,
}: TQueryTemplatesTabContentProps) => {
  const { token } = theme.useToken();
  const objSqlFieldStyle = fnCodeSurfaceStyle(token, 12);

  useEffect(() => {
    if (justAddedRef.current && fields.length > 0) {
      justAddedRef.current = false;
      setActiveKey(String(fields[fields.length - 1].key));
      return;
    }
    // 세트 삭제 시: 현재 활성 탭이 없어지면 마지막 세트 탭으로 전환
    if (fields.length > 0) {
      const keys = new Set(fields.map((f) => String(f.key)));
      if (!keys.has(activeKey) && activeKey !== QUERY_TABS_ADD_KEY) {
        setActiveKey(String(fields[fields.length - 1].key));
      }
    }
  }, [fields.length, fields, setActiveKey, justAddedRef, activeKey]);

  const tabItems = [
    ...fields.map(({ key, name, ...restField }) => ({
      key: String(key),
      label: `세트 ${name + 1}`,
      children: (
        <div style={{ paddingTop: 8 }}>
          {fields.length > 1 && (
            <div style={{ textAlign: 'right', marginBottom: 8 }}>
              <Button type="text" danger size="small" icon={<MinusCircleOutlined />} onClick={() => remove(name)}>
                이 세트 삭제
              </Button>
            </div>
          )}
          <Form.Item
            {...restField}
            name={[name, 'nDbConnectionId']}
            label="연결 DB (DB 구분: 종류·접속·DB명 등)"
            rules={[{ required: true, message: '연결 DB를 선택하세요.' }]}
            extra="환경(QA/LIVE) 구분이 아니라, 어떤 DB에 쿼리를 실행할지 구분합니다. QA/LIVE 반영은 이벤트 생성 시 결정됩니다."
          >
            <Select placeholder="DB 접속 선택 (종류·호스트·DB명)" showSearch optionFilterProp="children">
              {arrConnectionsByProduct.map((c) => (
                <Select.Option key={c.nId} value={c.nId}>
                  <Space wrap>
                    <DqpmTag color="blue">{c.strKind || 'GAME'}</DqpmTag>
                    <span>{c.strHost}:{c.nPort} / {c.strDatabase}</span>
                    <DqpmTag color={c.strEnv === 'live' ? 'red' : 'orange'} style={{ fontSize: 11 }}>{c.strEnv.toUpperCase()}</DqpmTag>
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item {...restField} name={[name, 'strDefaultItems']} label="기본 아이템값 (예시, 선택)">
            <Input className={STR_CODE_BLOCK_CLASS} placeholder="예: 1,2,3" style={objSqlFieldStyle} />
          </Form.Item>
          <Form.Item
            {...restField}
            name={[name, 'strQueryTemplate']}
            label="쿼리 템플릿"
            rules={[{ required: true, message: '쿼리 템플릿을 입력하세요.' }]}
          >
            <TextArea
              className={STR_CODE_BLOCK_CLASS}
              rows={4}
              placeholder="{{items}}, {{date}} 등 치환 가능"
              style={objSqlFieldStyle}
            />
          </Form.Item>
        </div>
      ),
    })),
    {
      key: QUERY_TABS_ADD_KEY,
      label: '+ 세트 추가',
      children: (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--ant-color-text-tertiary)' }}>
          새 쿼리 세트를 추가하려면 「+ 세트 추가」 탭을 클릭하세요.
        </div>
      ),
    },
  ];

  return (
    <Tabs
      type="card"
      activeKey={activeKey}
      onTabClick={(key) => {
        if (key === QUERY_TABS_ADD_KEY) {
          add({ nDbConnectionId: undefined, strQueryTemplate: '', strDefaultItems: '' });
          justAddedRef.current = true;
          setActiveKey(QUERY_TABS_ADD_KEY);
        } else {
          setActiveKey(key);
        }
      }}
      items={tabItems}
    />
  );
};

const EventPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const strDeepLinkTemplateId = searchParams.get('nTemplateId');
  const strDeepLinkInstanceId = searchParams.get('nInstanceId');

  const N_TEMPLATE_LIST_PAGE_SIZE = 10;
  const [nTemplateListPage, setNTemplateListPage] = useState(1);
  const [nHighlightInstanceId, setNHighlightInstanceId] = useState<number | null>(null);

  const [nSelectedTemplateId, setNSelectedTemplateId] = useState<number | null>(null);
  const [arrRelatedInstances, setArrRelatedInstances] = useState<IEventInstance[]>([]);
  const [nActiveRefCount, setNActiveRefCount] = useState(0);
  const [nRemovedRefCount, setNRemovedRefCount] = useState(0);
  const [bLoadingRelated, setBLoadingRelated] = useState(false);

  const [bModalOpen, setBModalOpen] = useState(false);
  const [objEditEvent, setObjEditEvent] = useState<IEventTemplate | null>(null);
  const [strQueryMode, setStrQueryMode] = useState<TQueryMode>('single');
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  /** 쿼리 템플릿 탭 활성 키 (세트 1, 세트 2, … 또는 __add__) */
  const [strQueryTabsActiveKey, setStrQueryTabsActiveKey] = useState('0');
  const bQueryTabsJustAddedRef = useRef(false);

  const arrEvents = useEventStore((s) => s.arrEvents);
  const fnFetchEvents = useEventStore((s) => s.fnFetchEvents);
  const fnAddEvent = useEventStore((s) => s.fnAddEvent);
  const fnUpdateEvent = useEventStore((s) => s.fnUpdateEvent);
  const fnDeleteEvent = useEventStore((s) => s.fnDeleteEvent);
  const arrProducts = useProductStore((s) => s.arrProducts);
  const fnFetchProducts = useProductStore((s) => s.fnFetchProducts);
  const arrDbConnections = useDbConnectionStore((s) => s.arrDbConnections);
  const fnFetchDbConnections = useDbConnectionStore((s) => s.fnFetchDbConnections);

  // 세분화 권한: 생성/수정/삭제 (레거시 event_template.manage 포함)
  const arrPermissions = useAuthStore((s) => s.user?.arrPermissions || []);
  const fnHas = (p: TPermission) => arrPermissions.includes(p);
  const bCanCreate = fnHas('event_template.create') || fnHas('event_template.manage');
  const bCanEdit   = fnHas('event_template.edit') || fnHas('event_template.manage');
  const bCanDelete = fnHas('event_template.delete') || fnHas('event_template.manage');
  const bCanOpenDashboard = fnHas('my_dashboard.view');

  const objSelectedTemplate = useMemo(
    () => (nSelectedTemplateId != null ? arrEvents.find((e) => e.nId === nSelectedTemplateId) : undefined),
    [arrEvents, nSelectedTemplateId],
  );

  const fnLoadRelatedInstances = useCallback(async (nTemplateId: number) => {
    setBLoadingRelated(true);
    try {
      const res = await fnApiGetEventInstancesByTemplate(nTemplateId);
      if (res.bSuccess && res.arrInstances) {
        setArrRelatedInstances(res.arrInstances);
        setNActiveRefCount(res.nActiveRefCount ?? 0);
        setNRemovedRefCount(res.nRemovedRefCount ?? 0);
      } else {
        setArrRelatedInstances([]);
        setNActiveRefCount(0);
        setNRemovedRefCount(0);
        messageApi.error(res.strMessage || '연결 이벤트 목록을 불러올 수 없습니다.');
      }
    } finally {
      setBLoadingRelated(false);
    }
  }, [messageApi]);

  useEffect(() => {
    if (nSelectedTemplateId == null) {
      setArrRelatedInstances([]);
      setNActiveRefCount(0);
      setNRemovedRefCount(0);
      return;
    }
    void fnLoadRelatedInstances(nSelectedTemplateId);
  }, [nSelectedTemplateId, fnLoadRelatedInstances]);

  const fnGoToDashboardInstance = (nInstanceId: number) => {
    if (!bCanOpenDashboard) {
      messageApi.warning('나의 대시보드 보기 권한이 필요합니다.');
      return;
    }
    navigate(`/my-dashboard?nId=${nInstanceId}`);
  };

  /** 선택한 템플릿 행 아래 펼침 영역 — 나의 대시보드 expandable 패턴과 동일 */
  const fnRenderRelatedInstancesPanel = () => {
    if (!objSelectedTemplate) return null;
    return (
      <div style={{ padding: '4px 8px 12px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Text strong style={{ fontSize: 13 }}>연결된 이벤트</Text>
          <DqpmTag>템플릿 ID {objSelectedTemplate.nId}</DqpmTag>
          <Text type="secondary" style={{ fontWeight: 400 }}>{objSelectedTemplate.strEventLabel}</Text>
          {objSelectedTemplate.strCreatedBy && (
            <DqpmTag color="blue">생성자 {objSelectedTemplate.strCreatedBy}</DqpmTag>
          )}
          {nActiveRefCount > 0 && (
            <DqpmTag color="orange">삭제 전 처리 필요 {nActiveRefCount}건</DqpmTag>
          )}
          {nRemovedRefCount > 0 && (
            <DqpmTag color="default">이미 서버 삭제됨 {nRemovedRefCount}건</DqpmTag>
          )}
          <Button size="small" onClick={() => void fnLoadRelatedInstances(objSelectedTemplate.nId)}>
            새로고침
          </Button>
        </div>
        {bLoadingRelated ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Spin tip="연결 이벤트 불러오는 중…" />
          </div>
        ) : arrRelatedInstances.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="이 템플릿으로 생성된 이벤트가 없습니다. 템플릿을 바로 삭제할 수 있습니다."
          />
        ) : (
          <>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
              행을 클릭하면 나의 대시보드에서 해당 이벤트 상세가 열립니다.
              {nActiveRefCount > 0 && ' 템플릿 삭제 전에는 아래 이벤트를 대시보드에서 삭제(복원 불가)해야 합니다.'}
            </Text>
            <AppTable<IEventInstance>
              strTableId="event_template_related_instances"
              rowKey="nId"
              size="small"
              pagination={{ pageSize: 8, showSizeChanger: false }}
              dataSource={arrRelatedInstances}
              rowClassName={(r) => (r.nId === nHighlightInstanceId ? 'ant-table-row-selected' : '')}
              onRow={(r) => ({
                onClick: () => fnGoToDashboardInstance(r.nId),
                style: { cursor: bCanOpenDashboard ? 'pointer' : 'default' },
              })}
              columns={[
                { title: '이벤트 번호', dataIndex: 'nId', width: 88 },
                {
                  title: '이벤트명',
                  dataIndex: 'strEventName',
                  ellipsis: true,
                  render: (str: string, r) => (
                    <Space size={4}>
                      {str}
                      {r.bPermanentlyRemoved && <DqpmTag color="red">삭제됨</DqpmTag>}
                    </Space>
                  ),
                },
                {
                  title: '상태',
                  dataIndex: 'strStatus',
                  width: 120,
                  render: (s: TEventStatus) => (
                    <Space size={4}>
                      {fnRenderStatusIcon(s, 12)}
                      <DqpmTag tone={OBJ_STATUS_CONFIG[s]?.strTagVariant}>{OBJ_STATUS_CONFIG[s]?.strLabel}</DqpmTag>
                    </Space>
                  ),
                },
                { title: '생성자', dataIndex: 'strCreatedBy', width: 100 },
                {
                  title: '생성일',
                  dataIndex: 'dtCreatedAt',
                  width: 140,
                  render: (v: string) => new Date(v).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }),
                },
                {
                  title: '',
                  key: 'go',
                  width: 72,
                  render: (_: unknown, r: IEventInstance) => (
                    <Button
                      type="link"
                      size="small"
                      icon={<LinkOutlined />}
                      disabled={!bCanOpenDashboard}
                      onClick={(e) => {
                        e.stopPropagation();
                        fnGoToDashboardInstance(r.nId);
                      }}
                    >
                      열기
                    </Button>
                  ),
                },
              ]}
            />
          </>
        )}
      </div>
    );
  };

  // 페이지 진입 시 이벤트/프로덕트/DB 접속 목록 로드(한 effect + 스토어 dedupe)
  useEffect(() => {
    void fnFetchEvents();
    void fnFetchProducts();
    void fnFetchDbConnections();
  }, [fnFetchEvents, fnFetchProducts, fnFetchDbConnections]);
  useAutoRefresh(fnFetchEvents);

  const fnOpenModal = useCallback((objEvent?: IEventTemplate) => {
    setStrQueryTabsActiveKey('0');
    if (objEvent) {
      setObjEditEvent(objEvent);
      const bMulti = (objEvent.arrQueryTemplates?.length ?? 0) > 0;
      setStrQueryMode('multi'); // 단일 쿼리 탭 숨김 → 항상 다중으로 표시
      if (bMulti) {
        form.setFieldsValue({
          ...objEvent,
          arrQueryTemplates: objEvent.arrQueryTemplates,
        });
      } else {
        // 기존 단일 템플릿 → 다중 폼에 1세트로 표시 (연결 DB는 사용자가 선택)
        const strQuery = objEvent.strQueryTemplate ?? '';
        const strDefault = objEvent.strDefaultItems ?? '';
        form.setFieldsValue({
          ...objEvent,
          arrQueryTemplates: [{ nDbConnectionId: undefined, strQueryTemplate: strQuery, strDefaultItems: strDefault }],
        });
      }
    } else {
      setObjEditEvent(null);
      setStrQueryMode('multi');
      form.resetFields();
      form.setFieldsValue({ arrQueryTemplates: [{ nDbConnectionId: undefined, strQueryTemplate: '', strDefaultItems: '' }] });
    }
    setBModalOpen(true);
  }, [form]);

  const fnCloseModal = () => {
    setBModalOpen(false);
    setObjEditEvent(null);
    form.resetFields();
  };

  const refDeepLinkTemplateApplied = useRef<number | null>(null);

  // 나의 대시보드 등 ?nTemplateId= — 목록에서 해당 행 선택·연결 이벤트 펼침 (수정 모달 아님)
  useEffect(() => {
    if (!strDeepLinkTemplateId) {
      refDeepLinkTemplateApplied.current = null;
      return;
    }
    const nTargetId = parseInt(strDeepLinkTemplateId, 10);
    if (isNaN(nTargetId) || refDeepLinkTemplateApplied.current === nTargetId) return;

    const nTplIndex = arrEvents.findIndex((e) => e.nId === nTargetId);
    if (nTplIndex < 0) return;

    refDeepLinkTemplateApplied.current = nTargetId;
    setNTemplateListPage(Math.floor(nTplIndex / N_TEMPLATE_LIST_PAGE_SIZE) + 1);
    setNSelectedTemplateId(nTargetId);

    const nInstId = strDeepLinkInstanceId ? parseInt(strDeepLinkInstanceId, 10) : NaN;
    setNHighlightInstanceId(!isNaN(nInstId) && nInstId > 0 ? nInstId : null);

    const objNextParams = new URLSearchParams(searchParams);
    objNextParams.delete('nTemplateId');
    objNextParams.delete('nInstanceId');
    setSearchParams(objNextParams, { replace: true });

    requestAnimationFrame(() => {
      window.setTimeout(() => {
        document
          .querySelector(`tr[data-row-key="${nTargetId}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 120);
    });
  }, [strDeepLinkTemplateId, strDeepLinkInstanceId, arrEvents, searchParams, setSearchParams]);

  const fnHandleSave = async () => {
    try {
      const objValues = await form.validateFields();
      const objProduct = arrProducts.find((p) => p.nId === objValues.nProductId);
      const bMulti = strQueryMode === 'multi';

      const objEventData: Record<string, unknown> = {
        ...objValues,
        strProductName: objProduct?.strName || '',
        strQueryTemplate: bMulti ? '' : (objValues.strQueryTemplate ?? ''),
        strDefaultItems: bMulti ? '' : (objValues.strDefaultItems ?? ''),
        arrQueryTemplates: bMulti
          ? (objValues.arrQueryTemplates ?? []).filter(
              (s: IQueryTemplateItem) => s.nDbConnectionId && (s.strQueryTemplate ?? '').trim()
            ).map((s: IQueryTemplateItem) => ({
              nDbConnectionId: Number(s.nDbConnectionId),
              strQueryTemplate: (s.strQueryTemplate ?? '').trim(),
              strDefaultItems: (s.strDefaultItems ?? '').trim() || undefined,
            }))
          : undefined,
      };

      if (bMulti && (!objEventData.arrQueryTemplates || (objEventData.arrQueryTemplates as unknown[]).length === 0)) {
        messageApi.warning('연결 DB와 쿼리 템플릿을 1세트 이상 입력해주세요.');
        return;
      }

      const result = objEditEvent
        ? await fnUpdateEvent(objEditEvent.nId, objEventData as Parameters<typeof fnUpdateEvent>[1])
        : await fnAddEvent(objEventData as Parameters<typeof fnAddEvent>[0]);

      if (result.bSuccess) {
        messageApi.success(result.strMessage);
        fnCloseModal();
      } else {
        messageApi.error(result.strMessage);
      }
    } catch {
      // 유효성 검사 실패 — Ant Design Form이 자체 인라인 에러 표시
    }
  };

  const fnHandleDelete = async (nId: number) => {
    const result = await fnDeleteEvent(nId);
    if (result.bSuccess) {
      messageApi.success(result.strMessage);
      if (nSelectedTemplateId === nId) {
        setNSelectedTemplateId(null);
      }
      return;
    }
    messageApi.error(result.strMessage);
    setNSelectedTemplateId(nId);
    void fnLoadRelatedInstances(nId);
  };

  // 입력 형식 라벨
  // 다중 쿼리 탭에서 선택된 프로덕트에 해당하는 DB 접속만 표시
  const nProductIdWatch = Form.useWatch('nProductId', form);
  const arrConnectionsByProduct = useMemo(() => {
    if (!nProductIdWatch) return [];
    return arrDbConnections.filter((c) => c.nProductId === nProductIdWatch && c.bIsActive);
  }, [arrDbConnections, nProductIdWatch]);

  const fnGetInputFormatLabel = (strFormat: TInputFormat) => {
    return ARR_INPUT_FORMATS.find((f) => f.value === strFormat)?.label || strFormat;
  };

  // 테이블 컬럼
  const arrColumns: ColumnsType<IEventTemplate> = [
    fnMakeIndexColumn<IEventTemplate>(),
    {
      title: '프로덕트',
      dataIndex: 'strProductName',
      key: 'strProductName',
      width: 120,
      render: (str: string) => <ProductNameTag strName={str} />,
    },
    {
      title: '이벤트명',
      dataIndex: 'strEventLabel',
      key: 'strEventLabel',
      width: 200,
    },
    {
      title: '생성자',
      dataIndex: 'strCreatedBy',
      key: 'strCreatedBy',
      width: 110,
      render: (str: string | undefined) => (
        <Text type={str ? undefined : 'secondary'} style={{ fontSize: 12 }}>
          {str?.trim() || '-'}
        </Text>
      ),
    },
    {
      title: '종류',
      dataIndex: 'strCategory',
      key: 'strCategory',
      width: 80,
      render: (str: TEventCategory) => (
        <DqpmTag tone={objCategoryVariant[str] ?? 'muted'}>{str}</DqpmTag>
      ),
    },
    {
      title: '유형',
      dataIndex: 'strType',
      key: 'strType',
      width: 80,
      render: (str: TEventType) => (
        <DqpmTag tone={objTypeVariant[str] ?? 'muted'}>{str}</DqpmTag>
      ),
    },
    {
      title: '입력 형식',
      dataIndex: 'strInputFormat',
      key: 'strInputFormat',
      width: 160,
      render: (str: TInputFormat) => fnGetInputFormatLabel(str),
    },
    {
      title: '쿼리',
      key: 'queryMode',
      width: 80,
      render: (_: unknown, objRecord: IEventTemplate) => {
        const arrSets = objRecord.arrQueryTemplates?.filter((s) => (s.strQueryTemplate ?? '').trim() && s.nDbConnectionId) ?? [];
        const nSetCount = arrSets.length;
        const strMode = nSetCount >= 2 ? '다중' : '단일';
        return <DqpmTag color={nSetCount >= 2 ? 'blue' : 'default'}>{strMode}</DqpmTag>;
      },
    },
    // 수정/삭제 권한이 있을 때만 관리 컬럼 표시
    ...((bCanEdit || bCanDelete) ? [{
      title: '관리',
      key: 'actions',
      width: 100,
      render: (_: unknown, objRecord: IEventTemplate) => (
        <Space onClick={(e) => e.stopPropagation()}>
          {bCanEdit && <Button type="text" icon={<EditOutlined />} onClick={() => fnOpenModal(objRecord)} />}
          {bCanDelete && (
            <Popconfirm
              title={
                nSelectedTemplateId === objRecord.nId && nActiveRefCount > 0
                  ? `연결 이벤트 ${nActiveRefCount}건이 있습니다. 먼저 아래 목록에서 대시보드로 이동해 삭제하세요.`
                  : '정말 삭제하시겠습니까?'
              }
              onConfirm={() => fnHandleDelete(objRecord.nId)}
              okText="삭제"
              cancelText="취소"
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    }] : []),
  ];

  return (
    <>
      {contextHolder}
      <CrudPageShell
        strTitle="쿼리 템플릿"
        nodeIcon={<CalendarOutlined />}
        nodeDescription="행을 클릭하면 아래에 이 템플릿으로 생성된 이벤트 목록이 펼쳐집니다. 활성 이벤트가 남아 있으면 템플릿 삭제 전 대시보드에서 정리해야 합니다."
        nodeExtra={
          bCanCreate ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => fnOpenModal()}>
              새로운 쿼리 템플릿
            </Button>
          ) : undefined
        }
      >
        <AppTable
          strTableId="event_templates"
          rowKey="nId"
          dataSource={arrEvents}
          columns={arrColumns}
          strEmptyText="등록된 쿼리 템플릿이 없습니다."
          expandable={{
            expandedRowKeys: nSelectedTemplateId != null ? [nSelectedTemplateId] : [],
            onExpand: (bExpanded, record) => {
              setNSelectedTemplateId(bExpanded ? record.nId : null);
            },
            expandedRowRender: () => fnRenderRelatedInstancesPanel(),
            expandIcon: () => null,
            columnWidth: 24,
            rowExpandable: () => true,
          }}
          rowClassName={(record) => (record.nId === nSelectedTemplateId ? 'ant-table-row-selected' : '')}
          pagination={{
            pageSize: N_TEMPLATE_LIST_PAGE_SIZE,
            current: nTemplateListPage,
            onChange: (page) => setNTemplateListPage(page),
            showSizeChanger: false,
          }}
          onRow={(record) => ({
            onClick: () => {
              setNHighlightInstanceId(null);
              setNSelectedTemplateId((prev) => (prev === record.nId ? null : record.nId));
            },
            style: { cursor: 'pointer' },
          })}
        />
      </CrudPageShell>

      {/* 이벤트 추가/수정 모달 */}
      <Modal
        title={objEditEvent ? '쿼리 템플릿 수정' : '쿼리 템플릿 추가'}
        open={bModalOpen}
        onOk={fnHandleSave}
        onCancel={fnCloseModal}
        okText={objEditEvent ? '수정' : '등록'}
        cancelText="취소"
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {/* 기본 정보 (탭 공통) */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="nProductId"
                label="프로덕트"
                rules={[{ required: true, message: '프로덕트를 선택해주세요.' }]}
              >
                <Select placeholder="프로덕트 선택">
                  {arrProducts.map((p) => (
                    <Select.Option key={p.nId} value={p.nId}>
                      {p.strName}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="strEventLabel"
                label="이벤트명"
                rules={[{ required: true, message: '이벤트명을 입력해주세요.' }]}
              >
                <Input placeholder="예: 어워드 이벤트 종료(아이템)" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="strCategory"
                label="이벤트 종류"
                rules={[{ required: true, message: '이벤트 종류를 선택해주세요.' }]}
              >
                <Select placeholder="종류 선택">
                  {ARR_EVENT_CATEGORIES.map((str) => (
                    <Select.Option key={str} value={str}>{str}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="strType"
                label="이벤트 유형"
                rules={[{ required: true, message: '이벤트 유형을 선택해주세요.' }]}
              >
                <Select placeholder="유형 선택">
                  {ARR_EVENT_TYPES.map((str) => (
                    <Select.Option key={str} value={str}>{str}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="strInputFormat"
                label="입력 형식"
                rules={[{ required: true, message: '입력 형식을 선택해주세요.' }]}
              >
                <Select placeholder="입력 형식 선택">
                  {ARR_INPUT_FORMATS.map((obj) => (
                    <Select.Option key={obj.value} value={obj.value}>{obj.label}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="strDescription" label="설명">
            <TextArea rows={2} placeholder="이벤트에 대한 설명 (사용자에게 표시)" />
          </Form.Item>

          {/* 단일 쿼리 탭 숨김 — 필요 시 items에 single 추가 */}
          <Tabs
            activeKey={strQueryMode}
            onChange={(k) => setStrQueryMode(k as TQueryMode)}
            items={[
              {
                key: 'multi',
                label: '쿼리 템플릿',
                children: (
                  <>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                      세트별로 <strong>DB 구분</strong>(종류·접속 등)과 쿼리 템플릿을 지정합니다. QA/LIVE 반영은 이벤트 생성 시 선택하며, 보통 QA 후 LIVE 순으로 진행합니다. 입력값 1개가 모든 세트에 동일 적용됩니다.
                    </Text>
                    <Form.List name="arrQueryTemplates">
                      {(fields, { add, remove }) => (
                        <QueryTemplatesTabContent
                          fields={fields}
                          add={add}
                          remove={remove}
                          arrConnectionsByProduct={arrConnectionsByProduct}
                          activeKey={strQueryTabsActiveKey}
                          setActiveKey={setStrQueryTabsActiveKey}
                          justAddedRef={bQueryTabsJustAddedRef}
                        />
                      )}
                    </Form.List>
                  </>
                ),
              },
            ]}
          />
        </Form>
      </Modal>
    </>
  );
};

export default EventPage;
