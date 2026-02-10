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
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useProductStore } from '../stores/useProductStore';
import type { IProduct, IService } from '../types';
import { ARR_REGION_OPTIONS } from '../types';

const { Title } = Typography;
const { TextArea } = Input;

const ProductPage = () => {
  const [bModalOpen, setBModalOpen] = useState(false);
  const [objEditProduct, setObjEditProduct] = useState<IProduct | null>(null);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const arrProducts = useProductStore((s) => s.arrProducts);
  const fnAddProduct = useProductStore((s) => s.fnAddProduct);
  const fnUpdateProduct = useProductStore((s) => s.fnUpdateProduct);
  const fnDeleteProduct = useProductStore((s) => s.fnDeleteProduct);

  // 모달 열기
  const fnOpenModal = (objProduct?: IProduct) => {
    if (objProduct) {
      setObjEditProduct(objProduct);
      form.setFieldsValue(objProduct);
    } else {
      setObjEditProduct(null);
      form.resetFields();
    }
    setBModalOpen(true);
  };

  const fnCloseModal = () => {
    setBModalOpen(false);
    setObjEditProduct(null);
    form.resetFields();
  };

  // 저장 처리
  const fnHandleSave = async () => {
    try {
      const objValues = await form.validateFields();

      if (objEditProduct) {
        fnUpdateProduct(objEditProduct.nId, objValues);
        messageApi.success('프로덕트가 수정되었습니다.');
      } else {
        fnAddProduct(objValues);
        messageApi.success('프로덕트가 등록되었습니다.');
      }
      fnCloseModal();
    } catch {
      // 유효성 검사 실패
    }
  };

  const fnHandleDelete = (nId: number) => {
    fnDeleteProduct(nId);
    messageApi.success('프로덕트가 삭제되었습니다.');
  };

  // DB 타입 색상
  const objDbTypeColor: Record<string, string> = {
    mysql: 'blue',
    mssql: 'orange',
    postgresql: 'green',
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
      title: '프로젝트명',
      dataIndex: 'strName',
      key: 'strName',
      width: 140,
    },
    {
      title: '서비스 범위',
      dataIndex: 'arrServices',
      key: 'arrServices',
      render: (arrServices: IService[]) => (
        <Space wrap>
          {arrServices.map((s) => (
            <Tag key={s.strAbbr} color="blue">
              <strong>{s.strAbbr}</strong> ({s.strRegion})
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'DB 타입',
      dataIndex: 'strDbType',
      key: 'strDbType',
      width: 100,
      render: (strType: string) => (
        <Tag color={objDbTypeColor[strType] || 'default'}>
          {strType.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: '설명',
      dataIndex: 'strDescription',
      key: 'strDescription',
      ellipsis: true,
    },
    {
      title: '관리',
      key: 'actions',
      width: 100,
      render: (_: unknown, objRecord: IProduct) => (
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
        <Title level={4} style={{ margin: 0 }}>프로덕트 관리</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => fnOpenModal()}>
          프로덕트 추가
        </Button>
      </div>

      <Card>
        <Table
          dataSource={arrProducts}
          columns={arrColumns}
          rowKey="nId"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: '등록된 프로덕트가 없습니다.' }}
        />
      </Card>

      {/* 프로덕트 추가/수정 모달 */}
      <Modal
        title={objEditProduct ? '프로덕트 수정' : '프로덕트 추가'}
        open={bModalOpen}
        onOk={fnHandleSave}
        onCancel={fnCloseModal}
        okText={objEditProduct ? '수정' : '등록'}
        cancelText="취소"
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="strName"
                label="프로젝트명"
                rules={[{ required: true, message: '프로젝트명을 입력해주세요.' }]}
              >
                <Input placeholder="예: DK온라인" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="strDbType"
                label="DB 타입"
                rules={[{ required: true, message: 'DB 타입을 선택해주세요.' }]}
              >
                <Select placeholder="DB 타입 선택">
                  <Select.Option value="mysql">MySQL</Select.Option>
                  <Select.Option value="mssql">MSSQL</Select.Option>
                  <Select.Option value="postgresql">PostgreSQL</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="strDescription" label="설명">
            <TextArea rows={2} placeholder="프로덕트에 대한 간단한 설명" />
          </Form.Item>

          {/* 서비스 범위 (동적 추가) */}
          <Form.List
            name="arrServices"
            rules={[
              {
                validator: async (_, arrServices) => {
                  if (!arrServices || arrServices.length === 0) {
                    return Promise.reject(new Error('서비스 범위를 최소 1개 추가해주세요.'));
                  }
                },
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                <div style={{ marginBottom: 8 }}>
                  <Typography.Text strong>서비스 범위</Typography.Text>
                </div>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                    <Col span={10}>
                      <Form.Item
                        {...restField}
                        name={[name, 'strAbbr']}
                        rules={[{ required: true, message: '약자 입력' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="약자 (예: DK/KR)" />
                      </Form.Item>
                    </Col>
                    <Col span={10}>
                      <Form.Item
                        {...restField}
                        name={[name, 'strRegion']}
                        rules={[{ required: true, message: '범위 선택' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Select placeholder="서비스 범위">
                          {ARR_REGION_OPTIONS.map((strRegion) => (
                            <Select.Option key={strRegion} value={strRegion}>
                              {strRegion}
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <MinusCircleOutlined
                        onClick={() => remove(name)}
                        style={{ color: '#ff4d4f', cursor: 'pointer', fontSize: 16 }}
                      />
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  서비스 범위 추가
                </Button>
                <Form.ErrorList errors={errors} />
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </>
  );
};

export default ProductPage;
