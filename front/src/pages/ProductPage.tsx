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
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useProductStore } from '../stores/useProductStore';
import type { IProduct } from '../types';

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

  // 모달 열기 (신규/수정)
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

  // 모달 닫기
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

  // 삭제 처리
  const fnHandleDelete = (nId: number) => {
    fnDeleteProduct(nId);
    messageApi.success('프로덕트가 삭제되었습니다.');
  };

  // DB 타입 색상 매핑
  const objDbTypeColor: Record<string, string> = {
    mysql: 'blue',
    mssql: 'orange',
    postgresql: 'green',
  };

  // 테이블 컬럼 정의
  const arrColumns = [
    {
      title: 'No.',
      key: 'index',
      width: 60,
      render: (_: unknown, __: unknown, nIndex: number) => nIndex + 1,
    },
    {
      title: '프로덕트명',
      dataIndex: 'strName',
      key: 'strName',
    },
    {
      title: '설명',
      dataIndex: 'strDescription',
      key: 'strDescription',
      ellipsis: true,
    },
    {
      title: 'DB 타입',
      dataIndex: 'strDbType',
      key: 'strDbType',
      width: 120,
      render: (strType: string) => (
        <Tag color={objDbTypeColor[strType] || 'default'}>
          {strType.toUpperCase()}
        </Tag>
      ),
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
      render: (_: unknown, objRecord: IProduct) => (
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
          프로덕트 관리
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => fnOpenModal()}
        >
          프로덕트 추가
        </Button>
      </div>

      <Card>
        <Table
          dataSource={arrProducts}
          columns={arrColumns}
          rowKey="nId"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: '등록된 프로덕트가 없습니다. 프로덕트를 추가해주세요.' }}
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
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="strName"
            label="프로덕트명"
            rules={[{ required: true, message: '프로덕트명을 입력해주세요.' }]}
          >
            <Input placeholder="예: 삼국지 온라인" />
          </Form.Item>
          <Form.Item
            name="strDescription"
            label="설명"
          >
            <TextArea rows={3} placeholder="프로덕트에 대한 간단한 설명" />
          </Form.Item>
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
        </Form>
      </Modal>
    </>
  );
};

export default ProductPage;
