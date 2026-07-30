import { useState, useEffect, useMemo, useCallback } from 'react';
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
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import AppTable, { fnMakeIndexColumn } from '../components/AppTable';
import CrudPageShell from '../components/CrudPageShell';
import { ProductNameTag } from '../components/ProductNameTag';
import { DqpmTag } from '../components/DqpmTag';
import type { TTagVariant } from '../styles/tagPalette';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined, AppstoreOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useProductStore } from '../stores/useProductStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import type { IProduct, IService, TPermission } from '../types';
import { ARR_REGION_OPTIONS } from '../types';
import { STR_SERVICE_SCOPE_LABEL } from '../utils/countryPlatformLabel';

const { TextArea } = Input;
const { Text } = Typography;

/** 프로덕트명 비교용 정규화 */
const fnNormalizeProductName = (strName: string | undefined): string =>
  (strName ?? '').trim();

const ProductPage = () => {
  const { token } = theme.useToken();
  const [bModalOpen, setBModalOpen] = useState(false);
  const [objEditProduct, setObjEditProduct] = useState<IProduct | null>(null);
  const [bSaving, setBSaving] = useState(false);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const strFormName = Form.useWatch('strName', form);

  const arrProducts = useProductStore((s) => s.arrProducts);
  const fnFetchProducts = useProductStore((s) => s.fnFetchProducts);
  const fnAddProduct = useProductStore((s) => s.fnAddProduct);
  const fnUpdateProduct = useProductStore((s) => s.fnUpdateProduct);
  const fnDeleteProduct = useProductStore((s) => s.fnDeleteProduct);

  // 세분화 권한: 생성/수정/삭제 (레거시 product.manage 포함)
  const arrPermissions = useAuthStore((s) => s.user?.arrPermissions || []);
  const fnHas = (p: TPermission) => arrPermissions.includes(p);
  const bCanCreate = fnHas('product.create') || fnHas('product.manage');
  const bCanEdit   = fnHas('product.edit') || fnHas('product.manage');
  const bCanDelete = fnHas('product.delete') || fnHas('product.manage');

  // 페이지 진입 및 탭 포커스 시 자동 리페치 (다른 유저가 수정한 내용 반영)
  useEffect(() => { fnFetchProducts(); }, [fnFetchProducts]);
  useAutoRefresh(fnFetchProducts);

  const fnFindNameDuplicateInList = useCallback((
    strName: string | undefined,
    nExcludeId?: number,
  ): IProduct | undefined => {
    const strNorm = fnNormalizeProductName(strName);
    if (!strNorm) return undefined;
    return arrProducts.find(
      (p) => p.nId !== nExcludeId && fnNormalizeProductName(p.strName) === strNorm,
    );
  }, [arrProducts]);

  const objNameDuplicate = useMemo(() => {
    if (!bModalOpen) return undefined;
    return fnFindNameDuplicateInList(strFormName, objEditProduct?.nId);
  }, [bModalOpen, strFormName, objEditProduct?.nId, fnFindNameDuplicateInList]);

  const fnOpenExistingFromNameDuplicate = () => {
    if (!objNameDuplicate) return;
    fnOpenModal(objNameDuplicate);
  };

  const nodeNameDuplicateHint = objNameDuplicate ? (
    <span style={{ fontSize: 12 }}>
      <ExclamationCircleOutlined style={{ marginRight: 4, color: token.colorWarning }} />
      <span style={{ color: token.colorWarning }}>이미 등록된 프로덕트명</span>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {' '}(#{objNameDuplicate.nId} · {objNameDuplicate.strDbType.toUpperCase()})
      </Text>
      {bCanEdit ? (
        <>
          {' · '}
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto', fontSize: 12 }}
            onClick={fnOpenExistingFromNameDuplicate}
          >
            수정
          </Button>
        </>
      ) : null}
    </span>
  ) : undefined;

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
    if (bSaving) return;
    setBModalOpen(false);
    setObjEditProduct(null);
    form.resetFields();
  };

  // 저장 처리 — antd 6 Modal onOk는 항상 닫히므로 footer 버튼에서만 호출
  const fnHandleSave = async () => {
    if (objNameDuplicate) return;
    setBSaving(true);
    try {
      const objValues = await form.validateFields();
      const result = objEditProduct
        ? await fnUpdateProduct(objEditProduct.nId, objValues)
        : await fnAddProduct(objValues);

      if (result.bSuccess) {
        messageApi.success(result.strMessage);
        fnCloseModal();
      } else {
        messageApi.error(result.strMessage);
      }
    } catch {
      // 유효성 검사 실패 — Ant Design Form이 자체 인라인 에러 표시
    } finally {
      setBSaving(false);
    }
  };

  const fnHandleDelete = async (nId: number) => {
    const result = await fnDeleteProduct(nId);
    messageApi[result.bSuccess ? 'success' : 'error'](result.strMessage);
  };

  const objDbTypeVariant: Record<string, TTagVariant> = {
    mysql: 'dbMysql',
    mssql: 'dbMssql',
    postgresql: 'dbPostgresql',
  };

  // 테이블 컬럼
  const arrColumns: ColumnsType<IProduct> = [
    fnMakeIndexColumn<IProduct>(),
    {
      title: '프로덕트명',
      dataIndex: 'strName',
      key: 'strName',
      width: 140,
      render: (str: string) => <ProductNameTag strName={str} />,
    },
    {
      title: STR_SERVICE_SCOPE_LABEL,
      dataIndex: 'arrServices',
      key: 'arrServices',
      render: (arrServices: IService[]) => (
        <Space wrap>
          {arrServices.map((s) => (
            <DqpmTag key={s.strAbbr} tone="service">
              <strong>{s.strAbbr}</strong> ({s.strRegion})
            </DqpmTag>
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
        <DqpmTag tone={objDbTypeVariant[strType] ?? 'muted'}>
          {strType.toUpperCase()}
        </DqpmTag>
      ),
    },
    {
      title: '설명',
      dataIndex: 'strDescription',
      key: 'strDescription',
      ellipsis: true,
    },
    // 수정/삭제 권한이 있을 때만 관리 컬럼 표시
    ...((bCanEdit || bCanDelete) ? [{
      title: '관리',
      key: 'actions',
      width: 100,
      render: (_: unknown, objRecord: IProduct) => (
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
      <CrudPageShell
        strTitle="프로덕트 관리"
        nodeIcon={<AppstoreOutlined />}
        nodeDescription="게임·서비스 단위 프로덕트와 서비스 구분 약자(FH/KR, LH/KR, DK/KR, DK/G 등)를 등록합니다. DB 종류(MSSQL/MySQL)는 프로덕트 단위로 고정됩니다."
        nodeExtra={
          bCanCreate ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => fnOpenModal()}>
              새로운 프로덕트
            </Button>
          ) : undefined
        }
      >
        <AppTable
          strTableId="products"
          dataSource={arrProducts}
          columns={arrColumns}
          strEmptyText="등록된 프로덕트가 없습니다."
        />
      </CrudPageShell>

      {/* 프로덕트 추가/수정 모달 */}
      <Modal
        title={objEditProduct ? '프로덕트 수정' : '프로덕트 추가'}
        open={bModalOpen}
        onCancel={fnCloseModal}
        footer={(
          <Space>
            <Button onClick={fnCloseModal} disabled={bSaving}>취소</Button>
            <Button
              type="primary"
              loading={bSaving}
              disabled={!!objNameDuplicate}
              onClick={() => void fnHandleSave()}
            >
              {objEditProduct ? '수정' : '등록'}
            </Button>
          </Space>
        )}
        width={640}
        destroyOnClose
        maskClosable={!bSaving}
        closable={!bSaving}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="strName"
                label="프로덕트명"
                rules={[{ required: true, message: '프로덕트명을 입력해주세요.' }]}
                validateStatus={objNameDuplicate ? 'warning' : undefined}
                help={nodeNameDuplicateHint}
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

          {/* 서비스 구분 (동적 추가) */}
          <Form.List
            name="arrServices"
            rules={[
              {
                validator: async (_, arrServices) => {
                  if (!arrServices || arrServices.length === 0) {
                    return Promise.reject(new Error(`${STR_SERVICE_SCOPE_LABEL}을(를) 최소 1개 추가해주세요.`));
                  }
                },
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                <div style={{ marginBottom: 8 }}>
                  <Typography.Text strong>{STR_SERVICE_SCOPE_LABEL}</Typography.Text>
                  <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                    FH/KR, LH/KR, DK/KR, DK/G …
                  </Typography.Text>
                </div>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                    {/* 약자만 바꿔도 기존 nServiceId 유지 — 없으면 서버가 신규 ID 발급 */}
                    <Form.Item {...restField} name={[name, 'nServiceId']} hidden>
                      <Input type="hidden" />
                    </Form.Item>
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
                        <Select placeholder="플랫폼 (국내·스팀 등)">
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
                        style={{ color: token.colorError, cursor: 'pointer', fontSize: 16 }}
                      />
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  {STR_SERVICE_SCOPE_LABEL} 추가
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
