import { useState } from 'react';
import {
  Typography,
  Button,
  Table,
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
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useEventStore } from '../stores/useEventStore';
import { useProductStore } from '../stores/useProductStore';
import type { IEventTemplate, TEventCategory, TEventType, TInputFormat } from '../types';
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

const EventPage = () => {
  const [bModalOpen, setBModalOpen] = useState(false);
  const [objEditEvent, setObjEditEvent] = useState<IEventTemplate | null>(null);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const arrEvents = useEventStore((s) => s.arrEvents);
  const fnAddEvent = useEventStore((s) => s.fnAddEvent);
  const fnUpdateEvent = useEventStore((s) => s.fnUpdateEvent);
  const fnDeleteEvent = useEventStore((s) => s.fnDeleteEvent);
  const arrProducts = useProductStore((s) => s.arrProducts);

  const fnOpenModal = (objEvent?: IEventTemplate) => {
    if (objEvent) {
      setObjEditEvent(objEvent);
      form.setFieldsValue(objEvent);
    } else {
      setObjEditEvent(null);
      form.resetFields();
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

      const objEventData = {
        ...objValues,
        strProductName: objProduct?.strName || '',
      };

      if (objEditEvent) {
        const bOk = await fnUpdateEvent(objEditEvent.nId, objEventData);
        messageApi[bOk ? 'success' : 'error'](bOk ? '이벤트 템플릿이 수정되었습니다.' : '수정에 실패했습니다.');
      } else {
        const bOk = await fnAddEvent(objEventData);
        messageApi[bOk ? 'success' : 'error'](bOk ? '이벤트 템플릿이 등록되었습니다.' : '등록에 실패했습니다.');
      }
      fnCloseModal();
    } catch {
      // 유효성 검사 실패
    }
  };

  const fnHandleDelete = async (nId: number) => {
    const bOk = await fnDeleteEvent(nId);
    messageApi[bOk ? 'success' : 'error'](bOk ? '이벤트 템플릿이 삭제되었습니다.' : '삭제에 실패했습니다.');
  };

  // 입력 형식 라벨
  const fnGetInputFormatLabel = (strFormat: TInputFormat) => {
    return ARR_INPUT_FORMATS.find((f) => f.value === strFormat)?.label || strFormat;
  };

  // 테이블 컬럼
  const arrColumns = [
    {
      title: 'No.',
      key: 'index',
      width: 50,
      render: (_: unknown, __: unknown, nIndex: number) => nIndex + 1,
    },
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
      title: '기본 아이템값',
      dataIndex: 'strDefaultItems',
      key: 'strDefaultItems',
      ellipsis: true,
      render: (str: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {str || '-'}
        </Text>
      ),
    },
    {
      title: '관리',
      key: 'actions',
      width: 100,
      render: (_: unknown, objRecord: IEventTemplate) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => fnOpenModal(objRecord)} />
          <Popconfirm
            title="정말 삭제하시겠습니까?"
            onConfirm={() => fnHandleDelete(objRecord.nId)}
            okText="삭제"
            cancelText="취소"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>이벤트 템플릿</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => fnOpenModal()}>
          이벤트 추가
        </Button>
      </div>

      <Card>
        <Table
          dataSource={arrEvents}
          columns={arrColumns}
          rowKey="nId"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: '등록된 이벤트 템플릿이 없습니다.' }}
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

          <Divider>쿼리 & 기본값</Divider>

          <Form.Item
            name="strDefaultItems"
            label="기본 아이템값 (예시)"
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                사용자가 이벤트 생성 시 기본으로 채워질 값입니다. 비워두면 사용자가 직접 입력합니다.
              </Text>
            }
          >
            <TextArea
              rows={3}
              placeholder="예: 7902, 9471, 9138, 11582"
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Form.Item>

          <Form.Item
            name="strQueryTemplate"
            label="쿼리 템플릿"
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                {'{{items}}'} = 입력된 아이템값, {'{{date}}'} = 실행 날짜, {'{{event_name}}'} = 이벤트 이름
              </Text>
            }
          >
            <TextArea
              rows={6}
              placeholder={`-- 쿼리 템플릿을 입력하세요\n-- {{items}}, {{date}}, {{event_name}} 치환 변수 사용 가능\nDELETE FROM event_items WHERE item_id IN ({{items}});`}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default EventPage;
