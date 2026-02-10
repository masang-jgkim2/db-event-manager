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
} from 'antd';
import {
  CodeOutlined,
  CopyOutlined,
  HistoryOutlined,
  ThunderboltOutlined,
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

        // 값이 없으면 빈 문자열
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

      messageApi.success('쿼리가 생성되었습니다.');
    } catch {
      messageApi.warning('필수 파라미터를 모두 입력해주세요.');
    }
  };

  // 클립보드 복사
  const fnCopyToClipboard = () => {
    navigator.clipboard.writeText(strGeneratedQuery);
    messageApi.success('클립보드에 복사되었습니다.');
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

      <Row gutter={24}>
        {/* 왼쪽: 조건 입력 */}
        <Col xs={24} lg={10}>
          <Card title="1. 프로덕트 & 이벤트 선택">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <Text strong>프로덕트</Text>
                <Select
                  style={{ width: '100%', marginTop: 4 }}
                  placeholder="프로덕트를 선택하세요"
                  onChange={fnHandleProductChange}
                  value={nSelectedProductId}
                >
                  {arrProducts.map((p) => (
                    <Select.Option key={p.nId} value={p.nId}>
                      {p.strName}
                    </Select.Option>
                  ))}
                </Select>
              </div>
              <div>
                <Text strong>이벤트</Text>
                <Select
                  style={{ width: '100%', marginTop: 4 }}
                  placeholder={
                    nSelectedProductId
                      ? '이벤트를 선택하세요'
                      : '프로덕트를 먼저 선택하세요'
                  }
                  disabled={!nSelectedProductId}
                  onChange={fnHandleEventChange}
                  value={nSelectedEventId}
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

          {/* 파라미터 입력 영역 */}
          {objSelectedEvent && objSelectedEvent.arrParams.length > 0 && (
            <Card title="2. 파라미터 입력" style={{ marginTop: 16 }}>
              <Form form={form} layout="vertical">
                {objSelectedEvent.arrParams.map((objParam: IEventParam) => (
                  <Form.Item
                    key={objParam.strKey}
                    name={objParam.strKey}
                    label={objParam.strLabel}
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
                }}
              >
                쿼리 생성
              </Button>
            </Card>
          )}

          {/* 이벤트는 선택했지만 파라미터가 없는 경우 */}
          {objSelectedEvent && objSelectedEvent.arrParams.length === 0 && (
            <Card style={{ marginTop: 16 }}>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={fnGenerateQuery}
                block
                size="large"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                }}
              >
                쿼리 생성 (파라미터 없음)
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
                <Button
                  icon={<CopyOutlined />}
                  onClick={fnCopyToClipboard}
                  type="primary"
                  ghost
                  size="small"
                >
                  복사
                </Button>
              )
            }
          >
            {strGeneratedQuery ? (
              <TextArea
                value={strGeneratedQuery}
                readOnly
                rows={12}
                style={{
                  fontFamily: 'monospace',
                  fontSize: 13,
                  background: '#1e1e1e',
                  color: '#d4d4d4',
                  border: 'none',
                  borderRadius: 8,
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
          locale={{ emptyText: '아직 생성된 쿼리가 없습니다.' }}
        />
      </Card>
    </>
  );
};

export default QueryPage;
