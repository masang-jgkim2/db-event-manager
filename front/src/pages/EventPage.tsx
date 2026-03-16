import { useState, useEffect, useMemo } from 'react';
import {
  Typography,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Popconfirm,
  message,
  Card,
  Row,
  Col,
  Tabs,
} from 'antd';
import AppTable, { fnMakeIndexColumn } from '../components/AppTable';
import { PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useEventStore } from '../stores/useEventStore';
import { useProductStore } from '../stores/useProductStore';
import { useAuthStore } from '../stores/useAuthStore';
import { fnApiGetDbConnections } from '../api/dbConnectionApi';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import type { IEventTemplate, IQueryTemplateItem, TEventCategory, TEventType, TInputFormat } from '../types';
import type { IDbConnection } from '../types';
import { ARR_EVENT_CATEGORIES, ARR_EVENT_TYPES, ARR_INPUT_FORMATS } from '../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

// 이벤트 종류 색상
const objCategoryColor: Record<string, string> = {
  '아이템': 'blue',
  '퀘스트': 'green',
};

// 이벤트 유형 색상
const objTypeColor: Record<string, string> = {
  '삭제': 'red',
  '지급': 'cyan',
  '초기화': 'orange',
};

// 쿼리 모드: 단일(한 연결 한 쿼리) / 다중(여러 연결·세트)
type TQueryMode = 'single' | 'multi';

const EventPage = () => {
  const [bModalOpen, setBModalOpen] = useState(false);
  const [objEditEvent, setObjEditEvent] = useState<IEventTemplate | null>(null);
  const [strQueryMode, setStrQueryMode] = useState<TQueryMode>('single');
  const [arrDbConnections, setArrDbConnections] = useState<IDbConnection[]>([]);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const arrEvents = useEventStore((s) => s.arrEvents);
  const fnFetchEvents = useEventStore((s) => s.fnFetchEvents);
  const fnAddEvent = useEventStore((s) => s.fnAddEvent);
  const fnUpdateEvent = useEventStore((s) => s.fnUpdateEvent);
  const fnDeleteEvent = useEventStore((s) => s.fnDeleteEvent);
  const arrProducts = useProductStore((s) => s.arrProducts);
  const fnFetchProducts = useProductStore((s) => s.fnFetchProducts);

  // 세분화 권한: 생성/수정/삭제 (레거시 event_template.manage 포함)
  const arrPermissions = useAuthStore((s) => s.user?.arrPermissions || []);
  const fnHas = (p: string) => arrPermissions.includes(p);
  const bCanCreate = fnHas('event_template.create') || fnHas('event_template.manage');
  const bCanEdit   = fnHas('event_template.edit') || fnHas('event_template.manage');
  const bCanDelete = fnHas('event_template.delete') || fnHas('event_template.manage');
  const bCanManage = bCanCreate || bCanEdit || bCanDelete;

  // 페이지 진입 시 이벤트/프로덕트/DB 접속 목록 로드
  useEffect(() => { fnFetchEvents(); fnFetchProducts(); }, [fnFetchEvents, fnFetchProducts]);
  useEffect(() => {
    let bMounted = true;
    const fnLoad = async () => {
      try {
        const res = await fnApiGetDbConnections();
        if (bMounted && res?.bSuccess && Array.isArray(res.arrDbConnections))
          setArrDbConnections(res.arrDbConnections);
      } catch {
        // 권한 없으면 빈 배열 유지
      }
    };
    fnLoad();
    return () => { bMounted = false; };
  }, []);
  useAutoRefresh(fnFetchEvents);

  const fnOpenModal = (objEvent?: IEventTemplate) => {
    if (objEvent) {
      setObjEditEvent(objEvent);
      const bMulti = (objEvent.arrQueryTemplates?.length ?? 0) > 0;
      setStrQueryMode(bMulti ? 'multi' : 'single');
      if (bMulti) {
        form.setFieldsValue({
          ...objEvent,
          arrQueryTemplates: objEvent.arrQueryTemplates,
        });
      } else {
        const strQuery = objEvent.arrQueryTemplates?.[0]?.strQueryTemplate ?? objEvent.strQueryTemplate ?? '';
        const strDefault = objEvent.arrQueryTemplates?.[0]?.strDefaultItems ?? objEvent.strDefaultItems ?? '';
        form.setFieldsValue({
          ...objEvent,
          strQueryTemplate: strQuery,
          strDefaultItems: strDefault,
        });
      }
    } else {
      setObjEditEvent(null);
      setStrQueryMode('single');
      form.resetFields();
      form.setFieldsValue({ arrQueryTemplates: [{ nDbConnectionId: undefined, strQueryTemplate: '', strDefaultItems: '' }] });
    }
    setBModalOpen(true);
  };

  const fnCloseModal = () => {
    setBModalOpen(false);
    setObjEditEvent(null);
    form.resetFields();
  };

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
        messageApi.warning('다중 쿼리에서는 연결 DB와 쿼리 템플릿을 1세트 이상 입력해주세요.');
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
    messageApi[result.bSuccess ? 'success' : 'error'](result.strMessage);
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
  const arrColumns = [
    fnMakeIndexColumn(),
    {
      title: '프로덕트',
      dataIndex: 'strProductName',
      key: 'strProductName',
      width: 120,
      render: (str: string) => <Tag>{str || '-'}</Tag>,
    },
    {
      title: '이벤트명',
      dataIndex: 'strEventLabel',
      key: 'strEventLabel',
      width: 200,
    },
    {
      title: '종류',
      dataIndex: 'strCategory',
      key: 'strCategory',
      width: 80,
      render: (str: TEventCategory) => (
        <Tag color={objCategoryColor[str] || 'default'}>{str}</Tag>
      ),
    },
    {
      title: '유형',
      dataIndex: 'strType',
      key: 'strType',
      width: 80,
      render: (str: TEventType) => (
        <Tag color={objTypeColor[str] || 'default'}>{str}</Tag>
      ),
    },
    {
      title: '입력 형식',
      dataIndex: 'strInputFormat',
      key: 'strInputFormat',
      width: 160,
      render: (str: TInputFormat) => fnGetInputFormatLabel(str),
    },
    // 수정/삭제 권한이 있을 때만 관리 컬럼 표시
    ...((bCanEdit || bCanDelete) ? [{
      title: '관리',
      key: 'actions',
      width: 100,
      render: (_: unknown, objRecord: IEventTemplate) => (
        <Space>
          {bCanEdit && <Button type="text" icon={<EditOutlined />} onClick={() => fnOpenModal(objRecord)} />}
          {bCanDelete && (
            <Popconfirm
              title="정말 삭제하시겠습니까?"
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>이벤트 템플릿</Title>
        {bCanCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => fnOpenModal()}>
            새로운 이벤트
          </Button>
        )}
      </div>

      <Card>
        <AppTable
          strTableId="event_templates"
          dataSource={arrEvents}
          columns={arrColumns}
          strEmptyText="등록된 이벤트 템플릿이 없습니다."
        />
      </Card>

      {/* 이벤트 추가/수정 모달 */}
      <Modal
        title={objEditEvent ? '이벤트 템플릿 수정' : '이벤트 템플릿 추가'}
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

          <Tabs
            activeKey={strQueryMode}
            onChange={(k) => setStrQueryMode(k as TQueryMode)}
            items={[
              {
                key: 'single',
                label: '단일 쿼리',
                children: (
                  <>
                    <Form.Item name="strDefaultItems" label="기본 아이템값 (예시)">
                      <TextArea rows={2} placeholder="예: 7902, 9471 (이벤트 생성 시 입력란 예시로 사용)" style={{ fontFamily: 'monospace', fontSize: 12 }} />
                    </Form.Item>
                    <Form.Item
                      name="strQueryTemplate"
                      label="쿼리 템플릿"
                      rules={strQueryMode === 'single' ? [{ required: true, message: '쿼리 템플릿을 입력하세요.' }] : []}
                    >
                      <TextArea
                        rows={6}
                        placeholder={'{{items}}, {{date}}, {{event_name}}, {{abbr}}, {{product}}, {{region}} 치환 가능'}
                        style={{ fontFamily: 'monospace', fontSize: 12 }}
                      />
                    </Form.Item>
                  </>
                ),
              },
              {
                key: 'multi',
                label: '다중 쿼리',
                children: (
                  <>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                      세트별로 <strong>DB 구분</strong>(종류·접속 등)과 쿼리 템플릿을 지정합니다. QA/LIVE 반영은 이벤트 생성 시 선택하며, 보통 QA 후 LIVE 순으로 진행합니다. 입력값 1개가 모든 세트에 동일 적용됩니다.
                    </Text>
                    <Form.List name="arrQueryTemplates">
                      {(fields, { add, remove }) => (
                        <>
                          {fields.map(({ key, name, ...restField }) => (
                            <Card key={key} size="small" style={{ marginBottom: 12 }} title={<Space>세트 {name + 1}</Space>} extra={fields.length > 1 ? <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} /> : null}>
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
                                        <Tag color="blue">{c.strKind || 'GAME'}</Tag>
                                        <span>{c.strHost}:{c.nPort} / {c.strDatabase}</span>
                                        <Tag color={c.strEnv === 'live' ? 'red' : 'orange'} style={{ fontSize: 11 }}>{c.strEnv.toUpperCase()}</Tag>
                                      </Space>
                                    </Select.Option>
                                  ))}
                                </Select>
                              </Form.Item>
                              <Form.Item {...restField} name={[name, 'strDefaultItems']} label="기본 아이템값 (예시, 선택)">
                                <Input placeholder="예: 1,2,3" style={{ fontFamily: 'monospace', fontSize: 12 }} />
                              </Form.Item>
                              <Form.Item
                                {...restField}
                                name={[name, 'strQueryTemplate']}
                                label="쿼리 템플릿"
                                rules={[{ required: true, message: '쿼리 템플릿을 입력하세요.' }]}
                              >
                                <TextArea rows={4} placeholder="{{items}}, {{date}} 등 치환 가능" style={{ fontFamily: 'monospace', fontSize: 12 }} />
                              </Form.Item>
                            </Card>
                          ))}
                          <Button type="dashed" onClick={() => add({ nDbConnectionId: undefined, strQueryTemplate: '', strDefaultItems: '' })} block style={{ marginBottom: 8 }}>
                            세트 추가
                          </Button>
                        </>
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
