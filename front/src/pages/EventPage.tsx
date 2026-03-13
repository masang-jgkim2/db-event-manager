import { useState, useEffect } from 'react';
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
  Divider,
} from 'antd';
import AppTable, { fnMakeIndexColumn } from '../components/AppTable';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useEventStore } from '../stores/useEventStore';
import { useProductStore } from '../stores/useProductStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { fnApiGetDbConnections } from '../api/dbConnectionApi';
import type { IEventTemplate, IQueryTemplateItem, TEventCategory, TEventType, TInputFormat } from '../types';
import { ARR_EVENT_CATEGORIES, ARR_EVENT_TYPES, ARR_INPUT_FORMATS } from '../types';
import type { IDbConnection } from '../types';

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

const EventPage = () => {
  const [bModalOpen, setBModalOpen] = useState(false);
  const [objEditEvent, setObjEditEvent] = useState<IEventTemplate | null>(null);
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
    const fnLoad = async () => {
      try {
        const res = await fnApiGetDbConnections();
        if (res.bSuccess && res.arrDbConnections) setArrDbConnections(res.arrDbConnections);
      } catch { /* ignore */ }
    };
    fnLoad();
  }, []);
  useAutoRefresh(fnFetchEvents);

  const fnOpenModal = (objEvent?: IEventTemplate) => {
    if (objEvent) {
      setObjEditEvent(objEvent);
      const nProductId = objEvent.nProductId;
      const arrConnForProduct = arrDbConnections.filter((c) => c.nProductId === nProductId);
      const nFirstConnId = arrConnForProduct[0]?.nId;
      // 기존 데이터가 strKind 기반이면 nDbConnectionId로 보정 (없으면 0 → 사용자가 재선택)
      const arrNormalized = objEvent.arrQueryTemplates?.length
        ? objEvent.arrQueryTemplates.map((qt: IQueryTemplateItem & { strKind?: string }) =>
            qt.nDbConnectionId
              ? { nDbConnectionId: qt.nDbConnectionId, strDefaultItems: qt.strDefaultItems ?? '', strQueryTemplate: qt.strQueryTemplate || '' }
              : { nDbConnectionId: nFirstConnId ?? 0, strDefaultItems: '', strQueryTemplate: qt.strQueryTemplate || '' }
          )
        : [{ nDbConnectionId: nFirstConnId ?? 0, strDefaultItems: '', strQueryTemplate: '' }];
      form.setFieldsValue({
        ...objEvent,
        arrQueryTemplates: arrNormalized,
      });
    } else {
      setObjEditEvent(null);
      form.resetFields();
      const nFirstConnId = arrDbConnections[0]?.nId;
      form.setFieldsValue({ arrQueryTemplates: [{ nDbConnectionId: nFirstConnId ?? 0, strDefaultItems: '', strQueryTemplate: '' }] });
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
      // 쿼리 템플릿 세트: DB 연결 선택 + 쿼리 내용 있는 것만 전송
      const arrQueryTemplates = (objValues.arrQueryTemplates as IQueryTemplateItem[] | undefined)?.filter(
        (qt) => qt.nDbConnectionId && qt.strQueryTemplate?.trim()
      );
      const objEventData = {
        ...objValues,
        strProductName: objProduct?.strName || '',
        arrQueryTemplates: arrQueryTemplates?.length ? arrQueryTemplates : undefined,
      };

      const result = objEditEvent
        ? await fnUpdateEvent(objEditEvent.nId, objEventData)
        : await fnAddEvent(objEventData);

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
    {
      title: '쿼리 세트',
      dataIndex: 'arrQueryTemplates',
      key: 'arrQueryTemplates',
      width: 90,
      render: (arr: IQueryTemplateItem[] | undefined) => (
        <Tag color={arr?.length ? 'blue' : 'default'}>{arr?.length ?? 0}개</Tag>
      ),
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
          {/* 기본 정보 */}
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

          <Divider>쿼리 템플릿 세트</Divider>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
            각 세트는 「DB 접속 정보 + 실행할 쿼리 템플릿」 한 묶음입니다. 이벤트 생성 시 단일 서버(한 환경만) 또는 다중 서버(QA→LIVE) 쿼리로 선택하고, 입력값이 치환되어 해당 DB에 실행됩니다. {'{{items}}'}, {'{{date}}'}, {'{{event_name}}'}, {'{{abbr}}'}, {'{{product}}'}, {'{{region}}'} 치환 가능.
          </Text>
          <Form.List name="arrQueryTemplates">
            {(arrFields, { add, remove }) => {
              const nProductId = form.getFieldValue('nProductId');
              const arrConnForProduct = nProductId
                ? arrDbConnections.filter((c) => c.nProductId === nProductId)
                : arrDbConnections;
              const nFirstConnId = arrConnForProduct[0]?.nId;
              return (
                <>
                  {arrFields.map(({ key, name, ...restField }) => (
                    <Card size="small" key={key} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <Form.Item
                          {...restField}
                          name={[name, 'nDbConnectionId']}
                          label="DB 연결 (DB 접속 정보)"
                          rules={[{ required: true, message: 'DB 연결을 선택하세요.' }]}
                          style={{ marginBottom: 0, minWidth: 280 }}
                        >
                          <Select
                            placeholder="DB 접속 정보 선택"
                            showSearch
                            optionFilterProp="children"
                            optionLabelProp="label"
                          >
                            {arrConnForProduct.map((c) => (
                              <Select.Option key={c.nId} value={c.nId} label={`${c.strProductName} / ${c.strKind || 'GAME'} / ${c.strHost}:${c.nPort}`}>
                                <Space>
                                  <Tag>{c.strProductName}</Tag>
                                  <Tag color="blue">{c.strKind || 'GAME'}</Tag>
                                  <Text type="secondary" style={{ fontSize: 12 }}>{c.strHost}:{c.nPort} / {c.strDatabase}</Text>
                                </Space>
                              </Select.Option>
                            ))}
                          </Select>
                        </Form.Item>
                        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                      </div>
                      <Form.Item
                        {...restField}
                        name={[name, 'strDefaultItems']}
                        label="기본 아이템값 (예시)"
                        style={{ marginBottom: 8 }}
                      >
                        <TextArea
                          rows={2}
                          placeholder="이 세트용 예시값 (예: 7902, 9471)"
                          style={{ fontFamily: 'monospace', fontSize: 12 }}
                        />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'strQueryTemplate']}
                        label="쿼리 템플릿"
                        style={{ marginBottom: 0 }}
                      >
                        <TextArea
                          rows={3}
                          placeholder="-- 해당 DB에서 실행할 쿼리 템플릿 ({{items}}, {{date}}, {{event_name}} 등 치환 가능)"
                          style={{ fontFamily: 'monospace', fontSize: 12 }}
                        />
                      </Form.Item>
                    </Card>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() => add({ nDbConnectionId: nFirstConnId ?? 0, strDefaultItems: '', strQueryTemplate: '' })}
                    block
                    icon={<PlusOutlined />}
                  >
                    쿼리 템플릿 추가
                  </Button>
                </>
              );
            }}
          </Form.List>
        </Form>
      </Modal>
    </>
  );
};

export default EventPage;
