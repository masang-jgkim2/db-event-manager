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
  Steps,
  Tooltip,
  Timeline,
  Alert,
} from 'antd';
import type { FormListFieldData } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import AppTable, { fnMakeIndexColumn } from '../components/AppTable';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined, LinkOutlined, CalendarOutlined,
  CodeOutlined, CopyOutlined,
} from '@ant-design/icons';
import CrudPageShell from '../components/CrudPageShell';
import { ProductNameTag } from '../components/ProductNameTag';
import { DqpmTag } from '../components/DqpmTag';
import { fnRenderConnectionSelectOption, OBJ_DB_CONNECTION_SELECT_PROPS } from '../components/DbConnectionSelectOption';
import QueryEditDiffView from '../components/QueryEditDiffView';
import SqlLineNumberArea from '../components/SqlLineNumberArea';
import { useEventStore } from '../stores/useEventStore';
import { useProductStore } from '../stores/useProductStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useDbConnectionStore } from '../stores/useDbConnectionStore';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import type {
  IEventTemplate, IQueryTemplateItem, IEventInstance, TEventCategory, TEventType, TInputFormat,
  IDbConnection, TPermission, TEventStatus, TTemplateStatus,
} from '../types';
import { ARR_EVENT_CATEGORIES, ARR_EVENT_TYPES, ARR_INPUT_FORMATS, OBJ_STATUS_CONFIG, OBJ_TEMPLATE_STATUS_CONFIG, ARR_TEMPLATE_STATUSES } from '../types';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fnApiGetEventInstancesByTemplate } from '../api/eventApi';
import { fnRenderStatusIcon, fnRenderTemplateStatusIcon, OBJ_TEMPLATE_STATUS_ICONS } from '../constants/statusIcons';
import type { TTagVariant } from '../styles/tagPalette';
import { fnCodeSurfaceStyle, STR_CODE_BLOCK_CLASS } from '../styles/queryEditorTokens';
import { fnFormatDbConnectionCountryPlatform, fnFormatCountryPlatformOption, STR_SERVICE_SCOPE_LABEL } from '../utils/countryPlatformLabel';
import {
  fnDeriveTemplateConnFilterAbbr,
  fnFilterConnectionsForTemplatePickerByEnv,
  fnFindLivePairForQaConnection,
  fnIsValidQueryTemplateSet,
  fnListTemplateServiceScopeAbbrs,
  fnMergeTemplatePickerConnections,
  fnNormalizeQueryTemplateItem,
  type TProductServiceLookup,
} from '../utils/dbConnectionScope';
import { fnReplaceItemsInTemplate } from '../utils/queryTemplateItems';

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

const fnResolveTemplateStatus = (obj: IEventTemplate): TTemplateStatus =>
  obj.strStatus ?? 'dba_confirmed';

const fnBuildTemplateSteps = (strStatus: TTemplateStatus) => {
  const arrSteps = ARR_TEMPLATE_STATUSES.map((s) => ({
    strStatus: s,
    strLabel: OBJ_TEMPLATE_STATUS_CONFIG[s].strLabel,
  }));
  const nCurrentIdx = arrSteps.findIndex((s) => s.strStatus === strStatus);
  const nStep = nCurrentIdx >= 0 ? nCurrentIdx : 0;
  const bFinished = strStatus === 'dba_confirmed';
  return { arrSteps, nStep, bFinished };
};

type TTemplateStepperProps = { objTemplate: IEventTemplate };
const TemplateStepper = ({ objTemplate }: TTemplateStepperProps) => {
  const { token } = theme.useToken();
  const strStatus = fnResolveTemplateStatus(objTemplate);
  const { arrSteps, nStep, bFinished } = fnBuildTemplateSteps(strStatus);

  return (
    <div style={{
      padding: '12px 16px 14px',
      marginBottom: 12,
      background: token.colorFillAlter,
      borderRadius: token.borderRadiusLG,
      border: `1px solid ${token.colorBorderSecondary}`,
    }}>
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>템플릿 진행</Text>
        <Space size={4}>
          {fnRenderTemplateStatusIcon(strStatus, 12)}
          <DqpmTag tone={OBJ_TEMPLATE_STATUS_CONFIG[strStatus].strTagVariant} style={{ fontSize: 11 }}>
            {OBJ_TEMPLATE_STATUS_CONFIG[strStatus].strLabel}
          </DqpmTag>
        </Space>
        {objTemplate.objConfirmer?.strDisplayName && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            승인: {objTemplate.objConfirmer.strDisplayName}
          </Text>
        )}
      </div>
      <Steps
        size="small"
        current={nStep}
        status={bFinished ? 'finish' : 'process'}
        items={arrSteps.map((s, nIdx) => ({
          title: <span style={{ fontSize: 12 }}>{s.strLabel}</span>,
          icon: fnRenderTemplateStatusIcon(s.strStatus, 14, nIdx <= nStep ? token.colorPrimary : token.colorTextDisabled),
        }))}
      />
    </div>
  );
};

// Form.List 렌더 prop 안에서는 훅 호출 불가 → 별도 컴포넌트로 분리
type TQueryTemplatesTabContentProps = {
  fields: FormListFieldData[];
  add: (defaultValue?: unknown, insertIndex?: number) => void;
  remove: (index: number | number[]) => void;
  arrQaConnections: IDbConnection[];
  arrLiveConnections: IDbConnection[];
  arrAllConnections: IDbConnection[];
  arrProducts: readonly TProductServiceLookup[];
  form: ReturnType<typeof Form.useForm>[0];
  activeKey: string;
  setActiveKey: (k: string) => void;
  justAddedRef: React.MutableRefObject<boolean>;
  /** 검증 실패 시 세트 index → 탭 key 매핑용 (index로 탭 전환) */
  tabKeysRef: React.MutableRefObject<string[]>;
};

const fnFilterValidTemplateSets = (arrSets?: IQueryTemplateItem[]) =>
  arrSets?.filter((s) => fnIsValidQueryTemplateSet(s)) ?? [];

const QueryTemplatesTabContent = ({
  fields,
  add,
  remove,
  arrQaConnections,
  arrLiveConnections,
  arrAllConnections,
  arrProducts,
  form,
  activeKey,
  setActiveKey,
  justAddedRef,
  tabKeysRef,
}: TQueryTemplatesTabContentProps) => {
  const { token } = theme.useToken();
  const objSqlFieldStyle = fnCodeSurfaceStyle(token, 12);

  // 세트 index → 탭 key 캐시 (검증 실패 시 해당 세트 탭으로 전환)
  tabKeysRef.current = fields.map((f) => String(f.key));

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
      // 비활성 탭도 마운트 — 미방문 세트의 폼 필드가 저장 payload에서 누락되는 문제 방지
      forceRender: true,
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
            name={[name, 'nQaDbConnectionId']}
            label={`QA 연결 DB (종류·${STR_SERVICE_SCOPE_LABEL}·DB)`}
            rules={[{ required: true, message: 'QA 연결 DB를 선택하세요.' }]}
          >
            <Select
              placeholder="QA DB 접속 선택"
              {...OBJ_DB_CONNECTION_SELECT_PROPS}
              onChange={(nId: number) => {
                const objQa = arrAllConnections.find((c) => c.nId === nId);
                if (!objQa) return;
                const objLive = fnFindLivePairForQaConnection(arrAllConnections, objQa);
                if (objLive) {
                  form.setFieldValue(['arrQueryTemplates', name, 'nLiveDbConnectionId'], objLive.nId);
                }
              }}
            >
              {arrQaConnections.map((c) => fnRenderConnectionSelectOption(c, arrProducts))}
            </Select>
          </Form.Item>
          <Form.Item
            {...restField}
            name={[name, 'nLiveDbConnectionId']}
            label={`LIVE 연결 DB (종류·${STR_SERVICE_SCOPE_LABEL}·DB)`}
            rules={[{ required: true, message: 'LIVE 연결 DB를 선택하세요.' }]}
            extra="QA 선택 시 동일 DB명 LIVE 접속이 있으면 자동으로 채워집니다."
          >
            <Select placeholder="LIVE DB 접속 선택" {...OBJ_DB_CONNECTION_SELECT_PROPS}>
              {arrLiveConnections.map((c) => fnRenderConnectionSelectOption(c, arrProducts))}
            </Select>
          </Form.Item>
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item
                {...restField}
                name={[name, 'strInputId']}
                label="입력 ID"
                tooltip="SQL 플레이스홀더 {{입력ID}} (기본 items)"
                rules={[
                  { required: true, message: '입력 ID를 입력하세요.' },
                  { pattern: /^[a-z][a-z0-9_]{0,31}$/, message: '소문자·숫자·_ (최대 32자)' },
                ]}
                initialValue="items"
              >
                <Input className={STR_CODE_BLOCK_CLASS} placeholder="items" style={objSqlFieldStyle} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                {...restField}
                name={[name, 'strInputFormat']}
                label="입력 형식"
                rules={[{ required: true, message: '입력 형식을 선택하세요.' }]}
                initialValue="item_number"
              >
                <Select placeholder="형식">
                  {ARR_INPUT_FORMATS.map((obj) => (
                    <Select.Option key={obj.value} value={obj.value}>{obj.label}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                {...restField}
                name={[name, 'strDefaultItems']}
                label="기본 입력값 (예시, 선택)"
              >
                <Input className={STR_CODE_BLOCK_CLASS} placeholder="예: 1,2,3" style={objSqlFieldStyle} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            {...restField}
            name={[name, 'strQueryTemplate']}
            label="쿼리 템플릿"
            rules={[{ required: true, message: '쿼리 템플릿을 입력하세요.' }]}
          >
            <TextArea
              className={STR_CODE_BLOCK_CLASS}
              rows={4}
              placeholder="{{items}} 또는 {{입력ID}}, {{date}} 등 치환 가능"
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
          add({
            nQaDbConnectionId: undefined,
            nLiveDbConnectionId: undefined,
            strInputId: 'items',
            strInputFormat: 'item_number',
            strQueryTemplate: '',
            strDefaultItems: '',
          });
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
  const [nPatchingTemplateId, setNPatchingTemplateId] = useState<number | null>(null);
  const [strStatusFilter, setStrStatusFilter] = useState<TTemplateStatus | ''>('');
  const bStatusFilterInitializedRef = useRef(false);

  const [bModalOpen, setBModalOpen] = useState(false);
  const [bSavingTemplate, setBSavingTemplate] = useState(false);
  const [strTemplateConnFilterAbbr, setStrTemplateConnFilterAbbr] = useState<string | undefined>(undefined);
  const [objEditEvent, setObjEditEvent] = useState<IEventTemplate | null>(null);
  const [strQueryMode, setStrQueryMode] = useState<TQueryMode>('single');
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  /** 쿼리 템플릿 탭 활성 키 (세트 1, 세트 2, … 또는 __add__) */
  const [strQueryTabsActiveKey, setStrQueryTabsActiveKey] = useState('0');
  const bQueryTabsJustAddedRef = useRef(false);
  /** 쿼리 세트 탭 index → key 매핑 (검증 실패 시 문제 세트 탭으로 전환) */
  const arrQueryTabKeysRef = useRef<string[]>([]);

  const [bQueryEditOpen, setBQueryEditOpen] = useState(false);
  const [objQueryEditTemplate, setObjQueryEditTemplate] = useState<IEventTemplate | null>(null);
  const [strQueryEditValue, setStrQueryEditValue] = useState('');
  /** DBA 세트 연결·미리보기 — 세트별 쿼리·QA/LIVE 연결 */
  const [arrQueryEditSets, setArrQueryEditSets] = useState<IQueryTemplateItem[]>([]);
  /** 미리보기 전용 입력값 — 기본값(strDefaultItems)과 분리, 저장하지 않음 */
  const [arrQueryEditPreviewInputs, setArrQueryEditPreviewInputs] = useState<string[]>([]);
  const [bSavingQueryEdit, setBSavingQueryEdit] = useState(false);

  const arrEvents = useEventStore((s) => s.arrEvents);
  const fnFetchEvents = useEventStore((s) => s.fnFetchEvents);
  const fnAddEvent = useEventStore((s) => s.fnAddEvent);
  const fnUpdateEvent = useEventStore((s) => s.fnUpdateEvent);
  const fnDeleteEvent = useEventStore((s) => s.fnDeleteEvent);
  const fnPatchEventStatus = useEventStore((s) => s.fnPatchEventStatus);
  const fnUpdateEventQuery = useEventStore((s) => s.fnUpdateEventQuery);
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
  const bCanRequestConfirm = fnHas('event_template.request_confirm');
  const bCanConfirm = fnHas('event_template.confirm');
  const bCanOpenDashboard = fnHas('my_dashboard.view');

  const { token } = theme.useToken();
  const objSqlFieldStyle = fnCodeSurfaceStyle(token, 12);

  useEffect(() => {
    if (bStatusFilterInitializedRef.current) return;
    // DBA는 리뷰 대기 건만 먼저 보이도록 기본 필터
    if (bCanConfirm && !bCanRequestConfirm) {
      setStrStatusFilter('confirm_requested');
    }
    bStatusFilterInitializedRef.current = true;
  }, [bCanConfirm, bCanRequestConfirm]);

  const arrFilteredEvents = useMemo(() => {
    if (!strStatusFilter) return arrEvents;
    return arrEvents.filter((e) => fnResolveTemplateStatus(e) === strStatusFilter);
  }, [arrEvents, strStatusFilter]);

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

  const fnHandleTemplateStatusChange = async (nTemplateId: number, strNextStatus: TTemplateStatus) => {
    setNPatchingTemplateId(nTemplateId);
    try {
      const result = await fnPatchEventStatus(nTemplateId, strNextStatus);
      if (result.bSuccess) {
        messageApi.success(
          strNextStatus === 'confirm_requested'
            ? '쿼리 리뷰를 요청했습니다.'
            : 'DBA 리뷰가 완료되었습니다.',
        );
      } else {
        messageApi.error(result.strMessage || '상태 변경에 실패했습니다.');
      }
    } finally {
      setNPatchingTemplateId(null);
    }
  };

  const fnRenderWorkflowActionButtons = (objRecord: IEventTemplate) => {
    const strStatus = fnResolveTemplateStatus(objRecord);
    const bLoading = nPatchingTemplateId === objRecord.nId;
    const fnRenderActionButton = (strNextStatus: TTemplateStatus) => {
      const Icon = OBJ_TEMPLATE_STATUS_ICONS[strNextStatus];
      return (
        <Button
          key={strNextStatus}
          icon={Icon ? <Icon /> : undefined}
          loading={bLoading}
          onClick={() => void fnHandleTemplateStatusChange(objRecord.nId, strNextStatus)}
        >
          {OBJ_TEMPLATE_STATUS_CONFIG[strNextStatus].strLabel}
        </Button>
      );
    };
    const arrButtons: React.ReactNode[] = [];
    if (bCanRequestConfirm && strStatus === 'template_created') {
      arrButtons.push(fnRenderActionButton('confirm_requested'));
    }
    if (bCanConfirm && (strStatus === 'confirm_requested' || strStatus === 'dba_confirmed')) {
      arrButtons.push(
        <Tooltip key="query-edit" title="연결·입력 미리보기">
          <Button
            type="text"
            icon={<CodeOutlined />}
            loading={bSavingQueryEdit && objQueryEditTemplate?.nId === objRecord.nId}
            onClick={() => fnOpenTemplateQueryEdit(objRecord)}
          />
        </Tooltip>,
      );
    }
    if (bCanConfirm && strStatus === 'confirm_requested') {
      arrButtons.push(fnRenderActionButton('dba_confirmed'));
    }
    return arrButtons;
  };

  /** 선택한 템플릿 행 아래 펼침 영역 — 워크플로 + 진행 이력 + 연결 이벤트 */
  const fnRenderRelatedInstancesPanel = () => {
    if (!objSelectedTemplate) return null;
    const arrLogs = objSelectedTemplate.arrStatusLogs ?? [];
    return (
      <div style={{ padding: '4px 8px 12px' }}>
        <TemplateStepper objTemplate={objSelectedTemplate} />
        {arrLogs.length > 0 && (
          <div style={{
            padding: '12px 16px',
            marginBottom: 12,
            background: token.colorFillAlter,
            borderRadius: token.borderRadiusLG,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}>
            <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>진행 이력</Text>
            <Timeline
              items={arrLogs.map((log) => ({
                color: log.strComment?.includes('재승인') ? token.colorWarning : token.colorPrimary,
                children: (
                  <div>
                    <Space size={4} wrap>
                      {fnRenderTemplateStatusIcon(log.strStatus, 12)}
                      <DqpmTag tone={OBJ_TEMPLATE_STATUS_CONFIG[log.strStatus].strTagVariant}>
                        {OBJ_TEMPLATE_STATUS_CONFIG[log.strStatus].strLabel}
                      </DqpmTag>
                    </Space>
                    <div>
                      <Text strong style={{ fontSize: 12 }}>{log.strChangedBy}</Text>
                      <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                        {new Date(log.dtChangedAt).toLocaleString('ko-KR')}
                      </Text>
                    </div>
                    {log.strComment && (
                      <Text
                        style={{
                          fontSize: 12,
                          display: 'block',
                          marginTop: 2,
                          color: log.strComment.includes('DBA 쿼리') ? token.colorError : token.colorTextSecondary,
                        }}
                      >
                        {log.strComment}
                      </Text>
                    )}
                    {log.objQueryEdit && (
                      <div style={{ marginTop: 6 }}>
                        <QueryEditDiffView objQueryEdit={log.objQueryEdit} />
                      </div>
                    )}
                  </div>
                ),
              }))}
            />
          </div>
        )}
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
    const strConnFilter = objEvent
      ? fnDeriveTemplateConnFilterAbbr(objEvent, arrDbConnections, arrProducts)
      : undefined;
    setStrTemplateConnFilterAbbr(strConnFilter);
    if (objEvent) {
      setObjEditEvent(objEvent);
      const bMulti = (objEvent.arrQueryTemplates?.length ?? 0) > 0;
      setStrQueryMode('multi'); // 단일 쿼리 탭 숨김 → 항상 다중으로 표시
      if (bMulti) {
        form.setFieldsValue({
          ...objEvent,
          arrQueryTemplates: objEvent.arrQueryTemplates?.map((s) =>
            fnNormalizeQueryTemplateItem(s, objEvent.strInputFormat),
          ),
        });
      } else {
        // 기존 단일 템플릿 → 다중 폼에 1세트로 표시 (연결 DB는 사용자가 선택)
        const strQuery = objEvent.strQueryTemplate ?? '';
        const strDefault = objEvent.strDefaultItems ?? '';
        const strFmt = objEvent.strInputFormat ?? 'item_number';
        form.setFieldsValue({
          ...objEvent,
          arrQueryTemplates: [{
            nQaDbConnectionId: undefined,
            nLiveDbConnectionId: undefined,
            strQueryTemplate: strQuery,
            strDefaultItems: strDefault,
            strInputId: 'items',
            strInputFormat: strFmt,
          }],
        });
      }
    } else {
      setObjEditEvent(null);
      setStrQueryMode('multi');
      form.resetFields();
      form.setFieldsValue({
        arrQueryTemplates: [{
          nQaDbConnectionId: undefined,
          nLiveDbConnectionId: undefined,
          strQueryTemplate: '',
          strDefaultItems: '',
          strInputId: 'items',
          strInputFormat: 'item_number',
        }],
      });
    }
    setBModalOpen(true);
  }, [form, arrDbConnections, arrProducts]);

  const fnCloseModal = () => {
    if (bSavingTemplate) return;
    setBModalOpen(false);
    setObjEditEvent(null);
    setStrTemplateConnFilterAbbr(undefined);
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

  const fnCopyQueryText = (str: string | undefined) => {
    if (!str) return;
    void navigator.clipboard.writeText(str).then(
      () => messageApi.success('클립보드에 복사했습니다.'),
      () => messageApi.error('복사에 실패했습니다.'),
    );
  };

  const fnOpenTemplateQueryEdit = (objTpl: IEventTemplate) => {
    setObjQueryEditTemplate(objTpl);
    const arrSets = fnFilterValidTemplateSets(objTpl.arrQueryTemplates);
    if (arrSets.length) {
      setArrQueryEditSets(arrSets.map((s) => ({
        ...fnNormalizeQueryTemplateItem(s, objTpl.strInputFormat),
        strDefaultItems: s.strDefaultItems,
        strQueryTemplate: s.strQueryTemplate ?? '',
      })));
      setArrQueryEditPreviewInputs(arrSets.map((s) => s.strDefaultItems ?? ''));
      setStrQueryEditValue('');
    } else {
      setStrQueryEditValue(objTpl.strQueryTemplate ?? '');
      setArrQueryEditSets([]);
      setArrQueryEditPreviewInputs([objTpl.strDefaultItems ?? '']);
    }
    setBQueryEditOpen(true);
  };

  const fnPatchQueryEditSet = (nIdx: number, patch: Partial<IQueryTemplateItem>) => {
    setArrQueryEditSets((prev) => prev.map((s, i) => (i === nIdx ? { ...s, ...patch } : s)));
  };

  const fnSaveTemplateQueryEdit = async () => {
    if (!objQueryEditTemplate) return;
    if (arrQueryEditSets.length > 0) {
      const bAllValid = arrQueryEditSets.every((s) => {
        const objNorm = fnNormalizeQueryTemplateItem(s, objQueryEditTemplate.strInputFormat);
        return objNorm.nQaDbConnectionId > 0 && objNorm.nLiveDbConnectionId > 0;
      });
      if (!bAllValid) {
        messageApi.warning('모든 세트에 QA/LIVE 연결 DB를 선택해주세요.');
        return;
      }
    }

    // 저장 대상(연결·입력ID/형식·쿼리)만 정규화 키로 비교 — 미리보기 입력값은 저장 안 하므로 제외.
    // 변경이 없으면 전용 API(쿼리 필수 변경)를 호출해 400을 받는 대신 조용히 닫는다.
    const fnEditSetsKey = (arrSets?: IQueryTemplateItem[]): string =>
      JSON.stringify(
        fnFilterValidTemplateSets(arrSets).map((s) => {
          const objNorm = fnNormalizeQueryTemplateItem(s, objQueryEditTemplate.strInputFormat);
          return {
            nQaDbConnectionId: objNorm.nQaDbConnectionId,
            nLiveDbConnectionId: objNorm.nLiveDbConnectionId,
            strInputId: objNorm.strInputId,
            strInputFormat: objNorm.strInputFormat,
            strDefaultItems: (s.strDefaultItems ?? '').trim(),
            strQueryTemplate: (s.strQueryTemplate ?? '').replace(/\r\n/g, '\n').trim(),
          };
        }),
      );
    const bQueryEditChanged = arrQueryEditSets.length
      ? fnEditSetsKey(objQueryEditTemplate.arrQueryTemplates) !== fnEditSetsKey(arrQueryEditSets)
      : (objQueryEditTemplate.strQueryTemplate ?? '').replace(/\r\n/g, '\n').trim() !== strQueryEditValue.trim();
    if (!bQueryEditChanged) {
      messageApi.info('변경 사항이 없습니다.');
      setBQueryEditOpen(false);
      return;
    }

    setBSavingQueryEdit(true);
    try {
      const payload: Record<string, unknown> = arrQueryEditSets.length
        ? {
            arrQueryTemplates: arrQueryEditSets.map((s) => {
              const objNorm = fnNormalizeQueryTemplateItem(s, objQueryEditTemplate.strInputFormat);
              return {
                nQaDbConnectionId: objNorm.nQaDbConnectionId,
                nLiveDbConnectionId: objNorm.nLiveDbConnectionId,
                strInputId: objNorm.strInputId,
                strInputFormat: objNorm.strInputFormat,
                strDefaultItems: s.strDefaultItems,
                strQueryTemplate: (s.strQueryTemplate ?? '').trim(),
              };
            }),
            strQueryTemplate: '',
            strInputFormat: fnNormalizeQueryTemplateItem(
              arrQueryEditSets[0] ?? {},
              objQueryEditTemplate.strInputFormat,
            ).strInputFormat,
          }
        : { strQueryTemplate: strQueryEditValue.trim(), strDefaultItems: objQueryEditTemplate.strDefaultItems ?? '' };
      const result = await fnUpdateEventQuery(objQueryEditTemplate.nId, payload);
      if (result.bSuccess) {
        messageApi.success(
          result.bReapprovalRequired
            ? '쿼리가 변경되어 쿼리 리뷰 요청 상태로 되돌아갔습니다.'
            : result.strMessage,
        );
        setBQueryEditOpen(false);
        if (nSelectedTemplateId === objQueryEditTemplate.nId && result.objEvent) {
          setObjQueryEditTemplate(result.objEvent);
        }
      } else {
        messageApi.error(result.strMessage);
      }
    } finally {
      setBSavingQueryEdit(false);
    }
  };

  const fnHandleSave = async () => {
    setBSavingTemplate(true);
    try {
      const objValues = await form.validateFields();
      const bMulti = strQueryMode === 'multi';

      const objEventData: Record<string, unknown> = { ...objValues };

      const bConfirmRequested = !!(objEditEvent && fnResolveTemplateStatus(objEditEvent) === 'confirm_requested');
      // 리뷰 대기: 일반 유저는 쿼리 잠금, DBA는 «수정»에서 SQL 저장 시 전용 API 사용
      const bQueryLocked = bConfirmRequested && !bCanConfirm;
      const bDbaSaveQueryViaApi = bConfirmRequested && bCanConfirm;

      let arrQueryPayload: IQueryTemplateItem[] | undefined;
      let strSingleQuery = '';
      let strSingleDefault = '';

      if (!bQueryLocked) {
        strSingleQuery = bMulti ? '' : (objValues.strQueryTemplate ?? '');
        strSingleDefault = bMulti ? '' : (objValues.strDefaultItems ?? '');
        arrQueryPayload = bMulti
          ? (objValues.arrQueryTemplates ?? [])
              .map((s: IQueryTemplateItem) => fnNormalizeQueryTemplateItem(s))
              .filter((objNorm: IQueryTemplateItem) =>
                objNorm.nQaDbConnectionId > 0 && objNorm.nLiveDbConnectionId > 0 && (objNorm.strQueryTemplate ?? '').trim())
              .map((objNorm: IQueryTemplateItem) => ({
                nQaDbConnectionId: objNorm.nQaDbConnectionId,
                nLiveDbConnectionId: objNorm.nLiveDbConnectionId,
                strInputId: (objNorm.strInputId ?? 'items').trim() || 'items',
                strInputFormat: objNorm.strInputFormat ?? 'item_number',
                strQueryTemplate: (objNorm.strQueryTemplate ?? '').trim(),
                strDefaultItems: (objNorm.strDefaultItems ?? '').trim() || undefined,
              }))
          : undefined;

        if (!bDbaSaveQueryViaApi) {
          objEventData.strQueryTemplate = strSingleQuery;
          objEventData.strDefaultItems = strSingleDefault;
          objEventData.arrQueryTemplates = arrQueryPayload;
        }
      }

      // 종류·유형은 템플릿, 입력 형식은 첫 세트 동기화(목록·레거시)
      if (!bQueryLocked && !bDbaSaveQueryViaApi && Array.isArray(objEventData.arrQueryTemplates) && (objEventData.arrQueryTemplates as IQueryTemplateItem[]).length > 0) {
        const arrSets = objEventData.arrQueryTemplates as IQueryTemplateItem[];
        objEventData.strInputFormat = arrSets[0]?.strInputFormat ?? 'item_number';
      }

      if (!bQueryLocked && bMulti && (!arrQueryPayload || arrQueryPayload.length === 0)) {
        messageApi.warning('QA/LIVE 연결 DB와 쿼리 템플릿을 1세트 이상 입력해주세요.');
        return;
      }

      if (objEditEvent && bDbaSaveQueryViaApi) {
        // 메타(종류·유형·설명 등)는 일반 PUT, 쿼리·세트는 전용 API(변경 있을 때만)
        delete objEventData.strQueryTemplate;
        delete objEventData.strDefaultItems;
        delete objEventData.arrQueryTemplates;
        delete objEventData.strInputFormat;

        const resultMeta = await fnUpdateEvent(objEditEvent.nId, objEventData as Parameters<typeof fnUpdateEvent>[1]);
        if (!resultMeta.bSuccess) {
          messageApi.error(resultMeta.strMessage);
          return;
        }

        const fnSetKey = (arr?: IQueryTemplateItem[]) => JSON.stringify(
          (arr ?? [])
            .map((s) => fnNormalizeQueryTemplateItem(s, objEditEvent.strInputFormat))
            .filter((s) => (s.strQueryTemplate ?? '').trim() && s.nQaDbConnectionId && s.nLiveDbConnectionId)
            .map((s) => ({
              nQaDbConnectionId: s.nQaDbConnectionId,
              nLiveDbConnectionId: s.nLiveDbConnectionId,
              strInputId: s.strInputId,
              strInputFormat: s.strInputFormat,
              strDefaultItems: (s.strDefaultItems ?? '').trim(),
              strQueryTemplate: (s.strQueryTemplate ?? '').replace(/\r\n/g, '\n').trim(),
            })),
        );
        const bQueryChanged = arrQueryPayload?.length
          ? fnSetKey(objEditEvent.arrQueryTemplates) !== fnSetKey(arrQueryPayload)
          : ((objEditEvent.strQueryTemplate ?? '').replace(/\r\n/g, '\n').trim() !== strSingleQuery.trim()
            || (objEditEvent.strDefaultItems ?? '').trim() !== strSingleDefault.trim());

        if (!bQueryChanged) {
          messageApi.success(resultMeta.strMessage);
          fnCloseModal();
          return;
        }

        const objQueryBody: Record<string, unknown> = arrQueryPayload?.length
          ? {
              arrQueryTemplates: arrQueryPayload,
              strQueryTemplate: '',
              strInputFormat: arrQueryPayload[0]?.strInputFormat ?? 'item_number',
            }
          : { strQueryTemplate: strSingleQuery.trim(), strDefaultItems: strSingleDefault };

        const resultQuery = await fnUpdateEventQuery(objEditEvent.nId, objQueryBody);
        if (resultQuery.bSuccess) {
          messageApi.success(resultQuery.strMessage || resultMeta.strMessage);
          fnCloseModal();
        } else {
          messageApi.error(resultQuery.strMessage);
        }
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
    } catch (err) {
      // 유효성 검사 실패 — 비활성(숨김) 세트 탭의 에러는 화면에 안 보이므로 해당 탭으로 전환·안내
      const arrErrorFields = (err as { errorFields?: Array<{ name: (string | number)[] }> })?.errorFields ?? [];
      const objSetError = arrErrorFields.find((f) => f.name?.[0] === 'arrQueryTemplates');
      if (objSetError) {
        const nErrSetIdx = Number(objSetError.name[1]);
        const strTabKey = arrQueryTabKeysRef.current[nErrSetIdx];
        if (strTabKey) setStrQueryTabsActiveKey(strTabKey);
        messageApi.warning(`세트 ${nErrSetIdx + 1}의 필수 항목(연결 DB·입력 ID·쿼리 등)을 확인해주세요.`);
      } else if (arrErrorFields.length > 0) {
        messageApi.warning('필수 입력 항목을 확인해주세요.');
      } else {
        // 필드 에러 없이 거부(폼 구조 변경 중 재검증 등) — 저장이 조용히 무반응되는 것을 방지
        console.error('[템플릿 저장] 검증 실패(필드 정보 없음)', err);
        messageApi.warning('저장을 완료하지 못했습니다. 다시 시도해주세요.');
      }
    } finally {
      setBSavingTemplate(false);
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

  // 다중 쿼리 탭 — 프로덕트·서비스 필터 + env별 QA/LIVE 연결 DB
  const nProductIdWatch = Form.useWatch('nProductId', form);
  const objFormProduct = useMemo(
    () => arrProducts.find((p) => p.nId === nProductIdWatch),
    [arrProducts, nProductIdWatch],
  );
  const arrQueryTemplatesWatch = Form.useWatch('arrQueryTemplates', form) as IQueryTemplateItem[] | undefined;

  const arrSelectedConnIds = useMemo(
    () =>
      (arrQueryTemplatesWatch ?? []).flatMap((s) => {
        const objNorm = fnNormalizeQueryTemplateItem(s ?? {});
        return [objNorm.nQaDbConnectionId, objNorm.nLiveDbConnectionId].filter((n) => n > 0);
      }),
    [arrQueryTemplatesWatch],
  );

  const arrQaConnections = useMemo(() => {
    if (!nProductIdWatch) return [];
    const arrFiltered = fnFilterConnectionsForTemplatePickerByEnv(
      arrDbConnections,
      nProductIdWatch,
      'qa',
      strTemplateConnFilterAbbr,
      arrProducts,
    );
    return fnMergeTemplatePickerConnections(
      arrFiltered,
      arrDbConnections,
      arrSelectedConnIds,
      nProductIdWatch,
    );
  }, [arrDbConnections, nProductIdWatch, strTemplateConnFilterAbbr, arrProducts, arrSelectedConnIds]);

  const arrLiveConnections = useMemo(() => {
    if (!nProductIdWatch) return [];
    const arrFiltered = fnFilterConnectionsForTemplatePickerByEnv(
      arrDbConnections,
      nProductIdWatch,
      'live',
      strTemplateConnFilterAbbr,
      arrProducts,
    );
    return fnMergeTemplatePickerConnections(
      arrFiltered,
      arrDbConnections,
      arrSelectedConnIds,
      nProductIdWatch,
    );
  }, [arrDbConnections, nProductIdWatch, strTemplateConnFilterAbbr, arrProducts, arrSelectedConnIds]);

  const strQueryEditConnFilterAbbr = useMemo(
    () => (objQueryEditTemplate
      ? fnDeriveTemplateConnFilterAbbr(objQueryEditTemplate, arrDbConnections, arrProducts)
      : undefined),
    [objQueryEditTemplate, arrDbConnections, arrProducts],
  );

  const arrQueryEditSelectedConnIds = useMemo(
    () => arrQueryEditSets.flatMap((s) => {
      const objNorm = fnNormalizeQueryTemplateItem(s);
      return [objNorm.nQaDbConnectionId, objNorm.nLiveDbConnectionId].filter((n) => n > 0);
    }),
    [arrQueryEditSets],
  );

  const nQueryEditProductId = objQueryEditTemplate?.nProductId ?? 0;

  const arrQueryEditQaConnections = useMemo(() => {
    if (!nQueryEditProductId) return [];
    const arrFiltered = fnFilterConnectionsForTemplatePickerByEnv(
      arrDbConnections,
      nQueryEditProductId,
      'qa',
      strQueryEditConnFilterAbbr,
      arrProducts,
    );
    return fnMergeTemplatePickerConnections(
      arrFiltered,
      arrDbConnections,
      arrQueryEditSelectedConnIds,
      nQueryEditProductId,
    );
  }, [arrDbConnections, nQueryEditProductId, strQueryEditConnFilterAbbr, arrProducts, arrQueryEditSelectedConnIds]);

  const arrQueryEditLiveConnections = useMemo(() => {
    if (!nQueryEditProductId) return [];
    const arrFiltered = fnFilterConnectionsForTemplatePickerByEnv(
      arrDbConnections,
      nQueryEditProductId,
      'live',
      strQueryEditConnFilterAbbr,
      arrProducts,
    );
    return fnMergeTemplatePickerConnections(
      arrFiltered,
      arrDbConnections,
      arrQueryEditSelectedConnIds,
      nQueryEditProductId,
    );
  }, [arrDbConnections, nQueryEditProductId, strQueryEditConnFilterAbbr, arrProducts, arrQueryEditSelectedConnIds]);

  const bShowTemplateConnFilter = !objEditEvent || fnResolveTemplateStatus(objEditEvent) !== 'confirm_requested';

  const fnGetInputFormatLabel = (strFormat: TInputFormat) => {
    return ARR_INPUT_FORMATS.find((f) => f.value === strFormat)?.label || strFormat;
  };

  // 테이블 컬럼
  const arrColumns: ColumnsType<IEventTemplate> = [
    fnMakeIndexColumn<IEventTemplate>(),
    {
      title: '프로덕트',
      key: 'strProductName',
      width: 120,
      render: (_: unknown, r: IEventTemplate) => {
        const strName = arrProducts.find((p) => p.nId === r.nProductId)?.strName ?? r.strProductName;
        return <ProductNameTag strName={strName} />;
      },
    },
    {
      title: STR_SERVICE_SCOPE_LABEL,
      key: 'strServiceScope',
      width: 130,
      render: (_: unknown, r: IEventTemplate) => {
        const arrAbbrs = fnListTemplateServiceScopeAbbrs(r, arrDbConnections, arrProducts);
        if (!arrAbbrs.length) {
          return <Text type="secondary">-</Text>;
        }
        return (
          <Space wrap size={4}>
            {arrAbbrs.map((strAbbr) => (
              <DqpmTag key={strAbbr || '__fallback'} tone="service" style={{ fontSize: 11 }}>
                {strAbbr.startsWith('#') ? strAbbr : fnFormatDbConnectionCountryPlatform(strAbbr || undefined)}
              </DqpmTag>
            ))}
          </Space>
        );
      },
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
      title: '입력',
      key: 'strInputFormat',
      width: 168,
      render: (_: unknown, objRecord: IEventTemplate) => {
        const arrSets = objRecord.arrQueryTemplates?.filter((s) => {
          const objNorm = fnNormalizeQueryTemplateItem(s, objRecord.strInputFormat);
          return (s.strQueryTemplate ?? '').trim() && objNorm.nQaDbConnectionId && objNorm.nLiveDbConnectionId;
        }) ?? [];
        if (arrSets.length === 0) {
          return fnGetInputFormatLabel(objRecord.strInputFormat);
        }
        const arrLabel = arrSets.map((s) => {
          const objNorm = fnNormalizeQueryTemplateItem(s, objRecord.strInputFormat);
          return `${objNorm.strInputId}:${fnGetInputFormatLabel(objNorm.strInputFormat ?? objRecord.strInputFormat)}`;
        });
        const strUnique = Array.from(new Set(arrLabel));
        return strUnique.length === 1 ? strUnique[0] : strUnique.join(', ');
      },
    },
    {
      title: '쿼리',
      key: 'queryMode',
      width: 80,
      render: (_: unknown, objRecord: IEventTemplate) => {
        const arrSets = objRecord.arrQueryTemplates?.filter((s) => {
          const objNorm = fnNormalizeQueryTemplateItem(s);
          return (s.strQueryTemplate ?? '').trim() && objNorm.nQaDbConnectionId && objNorm.nLiveDbConnectionId;
        }) ?? [];
        const nSetCount = arrSets.length;
        const strMode = nSetCount >= 2 ? '다중' : '단일';
        return <DqpmTag color={nSetCount >= 2 ? 'blue' : 'default'}>{strMode}</DqpmTag>;
      },
    },
    {
      title: '상태',
      dataIndex: 'strStatus',
      key: 'strStatus',
      width: 128,
      render: (_: unknown, objRecord: IEventTemplate) => {
        const s = fnResolveTemplateStatus(objRecord);
        return (
          <Space size={4}>
            {fnRenderTemplateStatusIcon(s, 12)}
            <DqpmTag tone={OBJ_TEMPLATE_STATUS_CONFIG[s].strTagVariant}>
              {OBJ_TEMPLATE_STATUS_CONFIG[s].strLabel}
            </DqpmTag>
          </Space>
        );
      },
    },
    // 관리 — 수정·삭제 + 리뷰 액션(권한·상태별)
    ...((bCanEdit || bCanDelete || bCanRequestConfirm || bCanConfirm) ? [{
      title: '관리',
      key: 'actions',
      width: 200,
      render: (_: unknown, objRecord: IEventTemplate) => {
        const arrWorkflow = fnRenderWorkflowActionButtons(objRecord);
        return (
          <Space onClick={(e) => e.stopPropagation()}>
            {bCanEdit && (
              <Tooltip title="수정">
                <Button type="text" icon={<EditOutlined />} onClick={() => fnOpenModal(objRecord)} />
              </Tooltip>
            )}
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
                <Tooltip title="삭제">
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
            {arrWorkflow}
          </Space>
        );
      },
    }] : []),
  ];

  return (
    <>
      {contextHolder}
      <CrudPageShell
        strTitle="쿼리 템플릿"
        nodeIcon={<CalendarOutlined />}
        nodeDescription="행을 클릭하면 템플릿 진행 상태와 이 템플릿으로 생성된 이벤트 목록이 펼쳐집니다. 활성 이벤트가 남아 있으면 템플릿 삭제 전 대시보드에서 정리해야 합니다."
        nodeExtra={
          bCanCreate ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => fnOpenModal()}>
              새로운 쿼리 템플릿
            </Button>
          ) : undefined
        }
      >
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>상태</Text>
          <Select
            style={{ width: 168 }}
            value={strStatusFilter || '__all__'}
            onChange={(v) => {
              setStrStatusFilter(v === '__all__' ? '' : (v as TTemplateStatus));
              setNTemplateListPage(1);
            }}
            options={[
              { value: '__all__', label: '전체' },
              ...ARR_TEMPLATE_STATUSES.map((s) => ({
                value: s,
                label: OBJ_TEMPLATE_STATUS_CONFIG[s].strLabel,
              })),
            ]}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {arrFilteredEvents.length}건
          </Text>
        </div>
        <AppTable
          strTableId="event_templates"
          rowKey="nId"
          dataSource={arrFilteredEvents}
          columns={arrColumns}
          strEmptyText="등록된 쿼리 템플릿이 없습니다."
          expandable={{
            expandedRowKeys: nSelectedTemplateId != null ? [nSelectedTemplateId] : [],
            onExpand: (bExpanded, record) => {
              setNSelectedTemplateId(bExpanded ? record.nId : null);
            },
            expandedRowRender: () => fnRenderRelatedInstancesPanel(),
            showExpandColumn: false,
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
        onCancel={fnCloseModal}
        footer={(
          <Space>
            <Button onClick={fnCloseModal} disabled={bSavingTemplate}>취소</Button>
            <Button type="primary" loading={bSavingTemplate} onClick={() => void fnHandleSave()}>
              {objEditEvent ? '수정' : '등록'}
            </Button>
          </Space>
        )}
        width={720}
        destroyOnClose
        maskClosable={!bSavingTemplate}
        closable={!bSavingTemplate}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {/* 기본 정보 (탭 공통) */}
          <Row gutter={16}>
            <Col span={bShowTemplateConnFilter ? 12 : 24}>
              <Form.Item
                name="nProductId"
                label="프로덕트"
                rules={[{ required: true, message: '프로덕트를 선택해주세요.' }]}
              >
                <Select
                  placeholder="프로덕트 선택"
                  onChange={() => setStrTemplateConnFilterAbbr(undefined)}
                >
                  {arrProducts.map((p) => (
                    <Select.Option key={p.nId} value={p.nId}>
                      {p.strName}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            {bShowTemplateConnFilter ? (
              <Col span={12}>
                <Form.Item label={`${STR_SERVICE_SCOPE_LABEL} (연결 DB 필터)`}>
                  <Select
                    allowClear
                    placeholder={objFormProduct ? '전체 표시 (필터 없음)' : '먼저 프로덕트를 선택하세요'}
                    disabled={!objFormProduct}
                    value={strTemplateConnFilterAbbr}
                    onChange={(v) => setStrTemplateConnFilterAbbr(v)}
                  >
                    {(objFormProduct?.arrServices ?? []).map((s) => (
                      <Select.Option key={s.strAbbr} value={s.strAbbr}>
                        {fnFormatCountryPlatformOption(s)}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            ) : null}
          </Row>

          <Form.Item
            name="strEventLabel"
            label="이벤트명"
            rules={[{ required: true, message: '이벤트명을 입력해주세요.' }]}
          >
            <Input placeholder="예: 어워드 이벤트 종료(아이템)" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
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
            <Col span={12}>
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
          </Row>
          {/* 입력 ID·형식은 쿼리 세트별 — 템플릿 strInputFormat은 저장 시 첫 세트에서 동기화 */}
          <Form.Item name="strInputFormat" hidden>
            <Input />
          </Form.Item>

          <Form.Item name="strDescription" label="설명">
            <TextArea rows={2} placeholder="이벤트에 대한 설명 (사용자에게 표시)" />
          </Form.Item>

          {objEditEvent && fnResolveTemplateStatus(objEditEvent) === 'confirm_requested' && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="쿼리 리뷰 대기 중"
              description={
                bCanConfirm
                  ? '템플릿 SQL·세트·연결은 아래에서 수정할 수 있습니다(저장 시 DBA 쿼리 API). «연결·입력 미리보기»는 연결·입력 ID·실행 미리보기용입니다.'
                  : '쿼리·세트·QA/LIVE 연결은 일반 «수정»으로 변경할 수 없습니다. DBA «연결·입력 미리보기»에서 연결·입력 설정을 변경합니다.'
              }
            />
          )}

          {objEditEvent && fnResolveTemplateStatus(objEditEvent) === 'dba_confirmed' && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="승인 완료 템플릿"
              description="쿼리·세트를 변경하면 DBA 재승인(쿼리 리뷰 요청) 상태로 되돌아갑니다."
            />
          )}

          {/* confirm_requested: SQL은 이 모달에서 확인(DBA는 수정), 연결·입력 ID는 «쿼리 수정» */}
          {!(objEditEvent && fnResolveTemplateStatus(objEditEvent) === 'confirm_requested' && !bCanConfirm) && (
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
                      세트별로 <strong>QA·LIVE 연결 DB</strong>를 각각 지정합니다. QA 선택 시 동일 DB명 LIVE 접속이 있으면 자동으로 채워집니다.
                    </Text>
                    {nProductIdWatch && arrQaConnections.length === 0 && arrLiveConnections.length === 0 ? (
                      <Alert
                        type="warning"
                        showIcon
                        style={{ marginBottom: 12 }}
                        message="등록된 DB 접속이 없습니다"
                        description={
                          strTemplateConnFilterAbbr
                            ? `${fnFormatDbConnectionCountryPlatform(strTemplateConnFilterAbbr)} · 활성 접속을 DB 접속 정보에서 등록해주세요.`
                            : '프로덕트에 활성 DB 접속을 등록한 뒤 연결 DB를 선택할 수 있습니다.'
                        }
                      />
                    ) : null}
                    <Form.List name="arrQueryTemplates">
                      {(fields, { add, remove }) => (
                        <QueryTemplatesTabContent
                          fields={fields}
                          add={add}
                          remove={remove}
                          arrQaConnections={arrQaConnections}
                          arrLiveConnections={arrLiveConnections}
                          arrAllConnections={arrDbConnections}
                          arrProducts={arrProducts}
                          form={form}
                          activeKey={strQueryTabsActiveKey}
                          setActiveKey={setStrQueryTabsActiveKey}
                          justAddedRef={bQueryTabsJustAddedRef}
                          tabKeysRef={arrQueryTabKeysRef}
                        />
                      )}
                    </Form.List>
                  </>
                ),
              },
            ]}
          />
          )}
        </Form>
      </Modal>

      <Modal
        title={(
          <Space>
            <CodeOutlined />
            연결·입력 미리보기
            {objQueryEditTemplate && (
              <>
                {fnRenderTemplateStatusIcon(fnResolveTemplateStatus(objQueryEditTemplate), 12)}
                <DqpmTag tone={OBJ_TEMPLATE_STATUS_CONFIG[fnResolveTemplateStatus(objQueryEditTemplate)].strTagVariant}>
                  {OBJ_TEMPLATE_STATUS_CONFIG[fnResolveTemplateStatus(objQueryEditTemplate)].strLabel}
                </DqpmTag>
              </>
            )}
          </Space>
        )}
        open={bQueryEditOpen}
        onCancel={() => { if (!bSavingQueryEdit) setBQueryEditOpen(false); }}
        footer={(
          <Space>
            <Button onClick={() => setBQueryEditOpen(false)} disabled={bSavingQueryEdit}>취소</Button>
            <Button type="primary" loading={bSavingQueryEdit} onClick={() => void fnSaveTemplateQueryEdit()}>
              저장
            </Button>
          </Space>
        )}
        width={760}
        destroyOnClose
        maskClosable={!bSavingQueryEdit}
        closable={!bSavingQueryEdit}
      >
        {objQueryEditTemplate && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Alert
              type="info"
              showIcon
              message={`템플릿: ${objQueryEditTemplate.strEventLabel}`}
              description={
                fnResolveTemplateStatus(objQueryEditTemplate) === 'dba_confirmed'
                  ? '승인 완료 템플릿입니다. QA/LIVE·입력 ID/형식을 변경하면 쿼리 리뷰 요청 상태로 되돌아갑니다. 템플릿 SQL·세트 추가·삭제·기본값은 «수정» 모달을 사용하세요.'
                  : 'QA/LIVE 연결·입력 ID/형식을 수정합니다. 아래 미리보기 입력값은 저장되지 않습니다. 템플릿 SQL·기본값은 «수정» 모달에서 편집하세요.'
              }
            />
            {arrQueryEditSets.length > 0 ? (
              <Tabs
                items={arrQueryEditSets.map((objSet, idx) => {
                  const objNorm = fnNormalizeQueryTemplateItem(
                    objSet,
                    objQueryEditTemplate?.strInputFormat,
                  );
                  return {
                    key: String(idx),
                    label: `세트 ${idx + 1}`,
                    children: (
                      <div style={{ marginTop: 8 }}>
                        <Space direction="vertical" style={{ width: '100%' }} size="middle">
                          <div>
                            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                              QA 연결 DB
                            </Text>
                            <Select
                              placeholder="QA DB 접속 선택"
                              {...OBJ_DB_CONNECTION_SELECT_PROPS}
                              value={objNorm.nQaDbConnectionId || undefined}
                              onChange={(nId: number) => {
                                const objQa = arrDbConnections.find((c) => c.nId === nId);
                                const patch: Partial<IQueryTemplateItem> = { nQaDbConnectionId: nId };
                                if (objQa) {
                                  const objLive = fnFindLivePairForQaConnection(arrDbConnections, objQa);
                                  if (objLive) patch.nLiveDbConnectionId = objLive.nId;
                                }
                                fnPatchQueryEditSet(idx, patch);
                              }}
                            >
                              {arrQueryEditQaConnections.map((c) => fnRenderConnectionSelectOption(c, arrProducts))}
                            </Select>
                          </div>
                          <div>
                            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                              LIVE 연결 DB
                            </Text>
                            <Select
                              placeholder="LIVE DB 접속 선택"
                              {...OBJ_DB_CONNECTION_SELECT_PROPS}
                              value={objNorm.nLiveDbConnectionId || undefined}
                              onChange={(nId: number) => fnPatchQueryEditSet(idx, { nLiveDbConnectionId: nId })}
                            >
                              {arrQueryEditLiveConnections.map((c) => fnRenderConnectionSelectOption(c, arrProducts))}
                            </Select>
                          </div>
                          <Row gutter={12}>
                            <Col span={6}>
                              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                                입력 ID
                              </Text>
                              <Input
                                className={STR_CODE_BLOCK_CLASS}
                                value={objNorm.strInputId ?? 'items'}
                                onChange={(e) => fnPatchQueryEditSet(idx, { strInputId: e.target.value })}
                                placeholder="items"
                                style={objSqlFieldStyle}
                              />
                            </Col>
                            <Col span={6}>
                              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                                입력 형식
                              </Text>
                              <Select
                                style={{ width: '100%' }}
                                value={objNorm.strInputFormat ?? 'item_number'}
                                onChange={(str) => fnPatchQueryEditSet(idx, { strInputFormat: str })}
                                options={ARR_INPUT_FORMATS.map((o) => ({ value: o.value, label: o.label }))}
                              />
                            </Col>
                            <Col span={12}>
                              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                                미리보기 입력값 (저장 안 함)
                              </Text>
                              <Input
                                className={STR_CODE_BLOCK_CLASS}
                                style={objSqlFieldStyle}
                                value={arrQueryEditPreviewInputs[idx] ?? ''}
                                onChange={(e) => {
                                  setArrQueryEditPreviewInputs((prev) => {
                                    const next = [...prev];
                                    while (next.length <= idx) next.push('');
                                    next[idx] = e.target.value;
                                    return next;
                                  });
                                }}
                                placeholder="예: 1,2,3"
                              />
                            </Col>
                          </Row>
                          {(() => {
                            const strTemplateSql = (objSet.strQueryTemplate ?? '').trim();
                            const strPreviewInput = (arrQueryEditPreviewInputs[idx] ?? '').trim();
                            const strFmt = (objNorm.strInputFormat ?? 'item_number') as TInputFormat;
                            const bSubstituted = strPreviewInput.length > 0;
                            const strPreviewQuery = bSubstituted
                              ? fnReplaceItemsInTemplate(
                                objSet.strQueryTemplate ?? '',
                                strPreviewInput,
                                strFmt,
                                objNorm.strInputId ?? 'items',
                              )
                              : strTemplateSql;
                            const strPreviewLabel = bSubstituted
                              ? '실행될 쿼리 (미리보기)'
                              : `쿼리 (플레이스홀더 {{${objNorm.strInputId ?? 'items'}}} — 입력값 있으면 치환)`;
                            return (
                              <div>
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 4,
                                  }}
                                >
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    {strPreviewLabel}
                                  </Text>
                                  {strPreviewQuery ? (
                                    <Button
                                      size="small"
                                      icon={<CopyOutlined />}
                                      onClick={() => fnCopyQueryText(strPreviewQuery)}
                                    >
                                      복사
                                    </Button>
                                  ) : null}
                                </div>
                                {strPreviewQuery ? (
                                  <SqlLineNumberArea
                                    strValue={strPreviewQuery}
                                    bReadOnly
                                    nFontSize={12}
                                    nMinRows={6}
                                    nMaxRows={18}
                                  />
                                ) : (
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    이 세트에 저장된 템플릿 SQL이 없습니다. «수정» 모달에서 확인하세요.
                                  </Text>
                                )}
                              </div>
                            );
                          })()}
                        </Space>
                      </div>
                    ),
                  };
                })}
              />
            ) : (
              (() => {
                const strPreviewInput = (arrQueryEditPreviewInputs[0] ?? '').trim();
                const strFmt = (objQueryEditTemplate.strInputFormat ?? 'item_number') as TInputFormat;
                const strPreviewQuery = strPreviewInput
                  ? fnReplaceItemsInTemplate(strQueryEditValue, strPreviewInput, strFmt, 'items')
                  : strQueryEditValue;
                return (
                  <div>
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                        미리보기 입력값 (저장 안 함)
                      </Text>
                      <Input
                        className={STR_CODE_BLOCK_CLASS}
                        style={objSqlFieldStyle}
                        value={arrQueryEditPreviewInputs[0] ?? ''}
                        onChange={(e) => setArrQueryEditPreviewInputs([e.target.value])}
                        placeholder="예: 1,2,3"
                      />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 4,
                      }}
                    >
                      <Text type="secondary" style={{ fontSize: 12 }}>실행될 쿼리 (미리보기)</Text>
                      {strPreviewQuery ? (
                        <Button
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => fnCopyQueryText(strPreviewQuery)}
                        >
                          복사
                        </Button>
                      ) : null}
                    </div>
                    {strPreviewQuery ? (
                      <SqlLineNumberArea
                        strValue={strPreviewQuery}
                        bReadOnly
                        nFontSize={12}
                        nMinRows={6}
                        nMaxRows={18}
                      />
                    ) : (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        템플릿 SQL은 «수정» 모달에서 확인·편집하세요.
                      </Text>
                    )}
                  </div>
                );
              })()
            )}
          </Space>
        )}
      </Modal>
    </>
  );
};

export default EventPage;
