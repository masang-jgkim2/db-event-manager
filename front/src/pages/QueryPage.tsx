import { useState, useMemo } from 'react';
import {
  Typography,
  Card,
  Form,
  Select,
  Button,
  Input,
  DatePicker,
  InputNumber,
  Row,
  Col,
  Divider,
  message,
  Space,
  Table,
  Tag,
  Steps,
  Result,
} from 'antd';
import {
  CodeOutlined,
  CopyOutlined,
  HistoryOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useProductStore } from '../stores/useProductStore';
import { useEventStore } from '../stores/useEventStore';
import { useQueryLogStore } from '../stores/useQueryLogStore';
import { useAuthStore } from '../stores/useAuthStore';
import type { IEventTemplate, IEventParam } from '../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

const QueryPage = () => {
  const [nSelectedProductId, setNSelectedProductId] = useState<number | null>(null);
  const [nSelectedEventId, setNSelectedEventId] = useState<number | null>(null);
  const [strGeneratedQuery, setStrGeneratedQuery] = useState('');
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const arrProducts = useProductStore((s) => s.arrProducts);
  const arrEvents = useEventStore((s) => s.arrEvents);
  const arrLogs = useQueryLogStore((s) => s.arrLogs);
  const fnAddLog = useQueryLogStore((s) => s.fnAddLog);
  const user = useAuthStore((s) => s.user);

  // 선택된 프로덕트에 해당하는 이벤트 필터
  const arrFilteredEvents = useMemo(() => {
    if (!nSelectedProductId) return [];
    return arrEvents.filter((e) => e.nProductId === nSelectedProductId);
  }, [nSelectedProductId, arrEvents]);

  // 선택된 이벤트 템플릿
  const objSelectedEvent: IEventTemplate | undefined = useMemo(() => {
    if (!nSelectedEventId) return undefined;
    return arrEvents.find((e) => e.nId === nSelectedEventId);
  }, [nSelectedEventId, arrEvents]);

  // 현재 스텝 계산
  const nCurrentStep = useMemo(() => {
    if (strGeneratedQuery) return 3;
    if (nSelectedEventId) return 2;
    if (nSelectedProductId) return 1;
    return 0;
  }, [nSelectedProductId, nSelectedEventId, strGeneratedQuery]);

  // 프로덕트 변경 시 이벤트 초기화
  const fnHandleProductChange = (nId: number) => {
    setNSelectedProductId(nId);
    setNSelectedEventId(null);
    setStrGeneratedQuery('');
    form.resetFields();
  };

  // 이벤트 변경
  const fnHandleEventChange = (nId: number) => {
    setNSelectedEventId(nId);
    setStrGeneratedQuery('');
    form.resetFields();
  };

  // 쿼리 생성
  const fnGenerateQuery = async () => {
    if (!objSelectedEvent) return;

    try {
      const objValues = await form.validateFields();

      let strQuery = objSelectedEvent.strQueryTemplate;

      // 템플릿의 {{key}} 를 실제 값으로 치환
      objSelectedEvent.arrParams.forEach((param: IEventParam) => {
        let strValue = objValues[param.strKey];

        // 날짜 타입 포맷팅
        if ((param.strType === 'date' || param.strType === 'datetime') && strValue) {
          strValue =
            param.strType === 'date'
              ? strValue.format('YYYY-MM-DD')
              : strValue.format('YYYY-MM-DD HH:mm:ss');
        }

        strValue = strValue ?? '';

        const regex = new RegExp(`\\{\\{${param.strKey}\\}\\}`, 'g');
        strQuery = strQuery.replace(regex, String(strValue));
      });

      setStrGeneratedQuery(strQuery);

      // 로그 기록
      const objProduct = arrProducts.find((p) => p.nId === nSelectedProductId);
      fnAddLog({
        nEventTemplateId: objSelectedEvent.nId,
        strEventName: objSelectedEvent.strName,
        strProductName: objProduct?.strName || '',
        strGeneratedQuery: strQuery,
        strCreatedBy: user?.strDisplayName || '',
      });

      messageApi.success('쿼리가 생성되었습니다!');
    } catch {
      messageApi.warning('필수 파라미터를 모두 입력해주세요.');
    }
  };

  // 클립보드 복사
  const fnCopyToClipboard = () => {
    navigator.clipboard.writeText(strGeneratedQuery);
    messageApi.success('클립보드에 복사되었습니다.');
  };

  // 초기화
  const fnReset = () => {
    setNSelectedProductId(null);
    setNSelectedEventId(null);
    setStrGeneratedQuery('');
    form.resetFields();
  };

  // 파라미터에 따른 입력 컴포넌트 렌더링
  const fnRenderParamInput = (objParam: IEventParam) => {
    switch (objParam.strType) {
      case 'number':
        return <InputNumber style={{ width: '100%' }} placeholder={`${objParam.strLabel} 입력`} />;
      case 'date':
        return <DatePicker style={{ width: '100%' }} placeholder={`${objParam.strLabel} 선택`} />;
      case 'datetime':
        return (
          <DatePicker
            showTime
            style={{ width: '100%' }}
            placeholder={`${objParam.strLabel} 선택`}
          />
        );
      case 'select':
        return (
          <Select placeholder={`${objParam.strLabel} 선택`}>
            {objParam.arrOptions?.map((strOpt) => (
              <Select.Option key={strOpt} value={strOpt}>
                {strOpt}
              </Select.Option>
            ))}
          </Select>
        );
      default:
        return <Input placeholder={`${objParam.strLabel} 입력`} />;
    }
  };

  // 이벤트가 하나도 없을 때
  if (arrProducts.length === 0 || arrEvents.length === 0) {
    return (
      <>
        {contextHolder}
        <Title level={4} style={{ marginBottom: 24 }}>
          <CodeOutlined /> 쿼리 생성
        </Title>
        <Card>
          <Result
            status="info"
            title="등록된 이벤트가 없습니다"
            subTitle={
              user?.strRole === 'admin'
                ? '먼저 프로덕트와 이벤트 템플릿을 등록해주세요.'
                : '관리자에게 이벤트 등록을 요청해주세요.'
            }
          />
        </Card>
      </>
    );
  }

  // 로그 테이블 컬럼
  const arrLogColumns = [
    {
      title: '시간',
      dataIndex: 'dtCreatedAt',
      key: 'dtCreatedAt',
      width: 160,
      render: (strDate: string) => new Date(strDate).toLocaleString('ko-KR'),
    },
    {
      title: '프로덕트',
      dataIndex: 'strProductName',
      key: 'strProductName',
      width: 120,
      render: (str: string) => <Tag>{str}</Tag>,
    },
    {
      title: '이벤트',
      dataIndex: 'strEventName',
      key: 'strEventName',
      width: 160,
    },
    {
      title: '생성자',
      dataIndex: 'strCreatedBy',
      key: 'strCreatedBy',
      width: 100,
    },
    {
      title: '쿼리',
      dataIndex: 'strGeneratedQuery',
      key: 'strGeneratedQuery',
      ellipsis: true,
    },
  ];

  return (
    <>
      {contextHolder}
      <Title level={4} style={{ marginBottom: 24 }}>
        <CodeOutlined /> 쿼리 생성
      </Title>

      {/* 진행 단계 표시 */}
      <Card style={{ marginBottom: 24 }}>
        <Steps
          current={nCurrentStep}
          items={[
            { title: '프로덕트 선택' },
            { title: '이벤트 선택' },
            { title: '값 입력' },
            { title: '쿼리 생성 완료', icon: strGeneratedQuery ? <CheckCircleOutlined /> : undefined },
          ]}
        />
      </Card>

      <Row gutter={24}>
        {/* 왼쪽: 조건 입력 */}
        <Col xs={24} lg={10}>
          <Card title="프로덕트 & 이벤트 선택" size="small">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>프로덕트</Text>
                <Select
                  style={{ width: '100%' }}
                  placeholder="프로덕트를 선택하세요"
                  onChange={fnHandleProductChange}
                  value={nSelectedProductId}
                  size="large"
                >
                  {arrProducts.map((p) => (
                    <Select.Option key={p.nId} value={p.nId}>
                      {p.strName}
                    </Select.Option>
                  ))}
                </Select>
              </div>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>이벤트</Text>
                <Select
                  style={{ width: '100%' }}
                  placeholder={
                    nSelectedProductId
                      ? '이벤트를 선택하세요'
                      : '프로덕트를 먼저 선택하세요'
                  }
                  disabled={!nSelectedProductId}
                  onChange={fnHandleEventChange}
                  value={nSelectedEventId}
                  size="large"
                >
                  {arrFilteredEvents.map((e) => (
                    <Select.Option key={e.nId} value={e.nId}>
                      {e.strName}
                    </Select.Option>
                  ))}
                </Select>
              </div>
            </Space>
          </Card>

          {/* 이벤트 설명 표시 */}
          {objSelectedEvent?.strDescription && (
            <Card size="small" style={{ marginTop: 12, background: '#f6f8fa' }}>
              <Text type="secondary">{objSelectedEvent.strDescription}</Text>
            </Card>
          )}

          {/* 파라미터 입력 영역 */}
          {objSelectedEvent && objSelectedEvent.arrParams.length > 0 && (
            <Card title="파라미터 입력" size="small" style={{ marginTop: 12 }}>
              <Form form={form} layout="vertical">
                {objSelectedEvent.arrParams.map((objParam: IEventParam) => (
                  <Form.Item
                    key={objParam.strKey}
                    name={objParam.strKey}
                    label={
                      <Space>
                        {objParam.strLabel}
                        {objParam.bRequired && <Tag color="red" style={{ fontSize: 11 }}>필수</Tag>}
                      </Space>
                    }
                    rules={
                      objParam.bRequired
                        ? [{ required: true, message: `${objParam.strLabel}을(를) 입력해주세요.` }]
                        : []
                    }
                    initialValue={objParam.strDefaultValue || undefined}
                  >
                    {fnRenderParamInput(objParam)}
                  </Form.Item>
                ))}
              </Form>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={fnGenerateQuery}
                block
                size="large"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  height: 48,
                  fontWeight: 600,
                }}
              >
                쿼리 생성
              </Button>
            </Card>
          )}

          {/* 파라미터 없는 이벤트 */}
          {objSelectedEvent && objSelectedEvent.arrParams.length === 0 && (
            <Card style={{ marginTop: 12 }}>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={fnGenerateQuery}
                block
                size="large"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  height: 48,
                  fontWeight: 600,
                }}
              >
                쿼리 생성
              </Button>
            </Card>
          )}
        </Col>

        {/* 오른쪽: 결과 표시 */}
        <Col xs={24} lg={14}>
          <Card
            title="생성된 쿼리"
            extra={
              strGeneratedQuery && (
                <Space>
                  <Button onClick={fnReset} size="small">
                    초기화
                  </Button>
                  <Button
                    icon={<CopyOutlined />}
                    onClick={fnCopyToClipboard}
                    type="primary"
                    ghost
                    size="small"
                  >
                    복사
                  </Button>
                </Space>
              )
            }
          >
            {strGeneratedQuery ? (
              <TextArea
                value={strGeneratedQuery}
                readOnly
                autoSize={{ minRows: 8, maxRows: 20 }}
                style={{
                  fontFamily: "'Consolas', 'Monaco', monospace",
                  fontSize: 13,
                  background: '#1e1e1e',
                  color: '#d4d4d4',
                  border: 'none',
                  borderRadius: 8,
                  padding: 16,
                }}
              />
            ) : (
              <div
                style={{
                  padding: '60px 0',
                  textAlign: 'center',
                  color: '#bfbfbf',
                }}
              >
                프로덕트와 이벤트를 선택하고 파라미터를 입력하면
                <br />
                쿼리가 자동으로 생성됩니다.
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 하단: 쿼리 생성 이력 */}
      {arrLogs.length > 0 && (
        <>
          <Divider />
          <Card
            title={
              <Space>
                <HistoryOutlined />
                <span>쿼리 생성 이력</span>
              </Space>
            }
          >
            <Table
              dataSource={arrLogs}
              columns={arrLogColumns}
              rowKey="nId"
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>
        </>
      )}
    </>
  );
};

export default QueryPage;
