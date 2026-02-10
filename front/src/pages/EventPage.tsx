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
  Divider,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import { useEventStore } from '../stores/useEventStore';
import { useProductStore } from '../stores/useProductStore';
import type { IEventTemplate } from '../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

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

  // 모달 열기
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

  // 모달 닫기
  const fnCloseModal = () => {
    setBModalOpen(false);
    setObjEditEvent(null);
    form.resetFields();
  };

  // 저장 처리
  const fnHandleSave = async () => {
    try {
      const objValues = await form.validateFields();

      // 프로덕트명 매핑
      const objProduct = arrProducts.find((p) => p.nId === objValues.nProductId);
      const objEventData = {
        ...objValues,
        strProductName: objProduct?.strName || '',
        arrParams: objValues.arrParams || [],
      };

      if (objEditEvent) {
        fnUpdateEvent(objEditEvent.nId, objEventData);
        messageApi.success('이벤트 템플릿이 수정되었습니다.');
      } else {
        fnAddEvent(objEventData);
        messageApi.success('이벤트 템플릿이 등록되었습니다.');
      }

      fnCloseModal();
    } catch {
      // 유효성 검사 실패
    }
  };

  // 삭제 처리
  const fnHandleDelete = (nId: number) => {
    fnDeleteEvent(nId);
    messageApi.success('이벤트 템플릿이 삭제되었습니다.');
  };

  // 테이블 컬럼
  const arrColumns = [
    {
      title: 'No.',
      key: 'index',
      width: 60,
      render: (_: unknown, __: unknown, nIndex: number) => nIndex + 1,
    },
    {
      title: '이벤트명',
      dataIndex: 'strName',
      key: 'strName',
    },
    {
      title: '프로덕트',
      dataIndex: 'strProductName',
      key: 'strProductName',
      render: (strName: string) => <Tag>{strName || '-'}</Tag>,
    },
    {
      title: '파라미터 수',
      dataIndex: 'arrParams',
      key: 'params',
      width: 100,
      render: (arrParams: unknown[]) => `${arrParams?.length || 0}개`,
    },
    {
      title: '설명',
      dataIndex: 'strDescription',
      key: 'strDescription',
      ellipsis: true,
    },
    {
      title: '등록일',
      dataIndex: 'dtCreatedAt',
      key: 'dtCreatedAt',
      width: 180,
      render: (strDate: string) => new Date(strDate).toLocaleString('ko-KR'),
    },
    {
      title: '관리',
      key: 'actions',
      width: 140,
      render: (_: unknown, objRecord: IEventTemplate) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => fnOpenModal(objRecord)}
          />
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
        <Title level={4} style={{ margin: 0 }}>
          이벤트 템플릿
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => fnOpenModal()}
        >
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
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="strName"
                label="이벤트명"
                rules={[{ required: true, message: '이벤트명을 입력해주세요.' }]}
              >
                <Input placeholder="예: 아이템 지급 이벤트" />
              </Form.Item>
            </Col>
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
          </Row>

          <Form.Item name="strDescription" label="설명">
            <TextArea rows={2} placeholder="이벤트에 대한 설명" />
          </Form.Item>

          <Form.Item
            name="strQueryTemplate"
            label="쿼리 템플릿"
            rules={[{ required: true, message: '쿼리 템플릿을 입력해주세요.' }]}
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                파라미터는 {'{{파라미터키}}'} 형식으로 입력하세요. 예: {'{{item_id}}'}, {'{{start_date}}'}
              </Text>
            }
          >
            <TextArea
              rows={6}
              placeholder={`INSERT INTO event_items (item_id, quantity, start_date, end_date)\nVALUES ({{item_id}}, {{quantity}}, '{{start_date}}', '{{end_date}}');`}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Form.Item>

          <Divider>파라미터 정의</Divider>

          {/* 동적 파라미터 목록 */}
          <Form.List name="arrParams">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                    <Col span={5}>
                      <Form.Item
                        {...restField}
                        name={[name, 'strKey']}
                        rules={[{ required: true, message: '키' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="키 (예: item_id)" size="small" />
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item
                        {...restField}
                        name={[name, 'strLabel']}
                        rules={[{ required: true, message: '라벨' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="라벨 (예: 아이템ID)" size="small" />
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item
                        {...restField}
                        name={[name, 'strType']}
                        rules={[{ required: true, message: '타입' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Select placeholder="타입" size="small">
                          <Select.Option value="string">문자열</Select.Option>
                          <Select.Option value="number">숫자</Select.Option>
                          <Select.Option value="date">날짜</Select.Option>
                          <Select.Option value="datetime">날짜+시간</Select.Option>
                          <Select.Option value="select">선택</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item
                        {...restField}
                        name={[name, 'strDefaultValue']}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="기본값 (선택)" size="small" />
                      </Form.Item>
                    </Col>
                    <Col span={3}>
                      <Form.Item
                        {...restField}
                        name={[name, 'bRequired']}
                        style={{ marginBottom: 0 }}
                        initialValue={true}
                      >
                        <Select size="small">
                          <Select.Option value={true}>필수</Select.Option>
                          <Select.Option value={false}>선택</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={1}>
                      <MinusCircleOutlined
                        onClick={() => remove(name)}
                        style={{ color: '#ff4d4f', cursor: 'pointer' }}
                      />
                    </Col>
                  </Row>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add()}
                  block
                  icon={<PlusOutlined />}
                >
                  파라미터 추가
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </>
  );
};

export default EventPage;
