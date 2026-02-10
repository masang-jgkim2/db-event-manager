import { useState, useMemo } from 'react';
import {
  Typography,
  Card,
  Form,
  Select,
  Button,
  Input,
  DatePicker,
  Row,
  Col,
  message,
  Space,
  Tag,
  Steps,
  Result,
  Alert,
} from 'antd';
import {
  CodeOutlined,
  CopyOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useProductStore } from '../stores/useProductStore';
import { useEventStore } from '../stores/useEventStore';
import { useAuthStore } from '../stores/useAuthStore';
import { fnApiCreateInstance } from '../api/eventInstanceApi';
import type { IEventTemplate, IService } from '../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

const QueryPage = () => {
  // 선택 상태
  const [nSelectedProductId, setNSelectedProductId] = useState<number | null>(null);
  const [strSelectedAbbr, setStrSelectedAbbr] = useState<string | null>(null);
  const [nSelectedEventId, setNSelectedEventId] = useState<number | null>(null);

  // 입력 상태
  const [strEventName, setStrEventName] = useState('');
  const [strInputValues, setStrInputValues] = useState('');
  const [strExecDate, setStrExecDate] = useState('');

  // 결과
  const [strGeneratedQuery, setStrGeneratedQuery] = useState('');

  const [messageApi, contextHolder] = message.useMessage();

  const [bSubmitting, setBSubmitting] = useState(false);

  const arrProducts = useProductStore((s) => s.arrProducts);
  const arrEvents = useEventStore((s) => s.arrEvents);
  const user = useAuthStore((s) => s.user);

  // 선택된 프로덕트
  const objSelectedProduct = useMemo(() => {
    return arrProducts.find((p) => p.nId === nSelectedProductId) || null;
  }, [nSelectedProductId, arrProducts]);

  // 선택된 서비스
  const objSelectedService = useMemo((): IService | null => {
    if (!objSelectedProduct || !strSelectedAbbr) return null;
    return objSelectedProduct.arrServices.find((s) => s.strAbbr === strSelectedAbbr) || null;
  }, [objSelectedProduct, strSelectedAbbr]);

  // 선택된 프로덕트에 해당하는 이벤트 필터
  const arrFilteredEvents = useMemo(() => {
    if (!nSelectedProductId) return [];
    return arrEvents.filter((e) => e.nProductId === nSelectedProductId);
  }, [nSelectedProductId, arrEvents]);

  // 선택된 이벤트 템플릿
  const objSelectedEvent: IEventTemplate | null = useMemo(() => {
    if (!nSelectedEventId) return null;
    return arrEvents.find((e) => e.nId === nSelectedEventId) || null;
  }, [nSelectedEventId, arrEvents]);

  // 현재 스텝
  const nCurrentStep = useMemo(() => {
    if (strGeneratedQuery) return 4;
    if (nSelectedEventId) return 3;
    if (strSelectedAbbr) return 2;
    if (nSelectedProductId) return 1;
    return 0;
  }, [nSelectedProductId, strSelectedAbbr, nSelectedEventId, strGeneratedQuery]);

  // 이벤트 이름 자동 생성
  const fnGenerateEventName = (strAbbr: string, strEventLabel: string) => {
    const strToday = dayjs().format('M월 D일');
    return `[${strAbbr}] ${strToday}, ${strEventLabel}`;
  };

  // === 선택 핸들러 ===
  const fnHandleProductChange = (nId: number) => {
    setNSelectedProductId(nId);
    setStrSelectedAbbr(null);
    setNSelectedEventId(null);
    setStrEventName('');
    setStrInputValues('');
    setStrExecDate('');
    setStrGeneratedQuery('');

    // 서비스가 1개뿐이면 자동 선택
    const objProduct = arrProducts.find((p) => p.nId === nId);
    if (objProduct && objProduct.arrServices.length === 1) {
      setStrSelectedAbbr(objProduct.arrServices[0].strAbbr);
    }
  };

  const fnHandleServiceChange = (strAbbr: string) => {
    setStrSelectedAbbr(strAbbr);
    setNSelectedEventId(null);
    setStrEventName('');
    setStrInputValues('');
    setStrGeneratedQuery('');
  };

  const fnHandleEventChange = (nId: number) => {
    setNSelectedEventId(nId);
    setStrGeneratedQuery('');

    const objEvent = arrEvents.find((e) => e.nId === nId);
    if (objEvent && strSelectedAbbr) {
      // 이벤트 이름 자동 생성
      setStrEventName(fnGenerateEventName(strSelectedAbbr, objEvent.strEventLabel));

      // 기본 아이템값이 있으면 자동 채움
      if (objEvent.strDefaultItems) {
        setStrInputValues(objEvent.strDefaultItems);
      } else {
        setStrInputValues('');
      }
    }
  };

  // === 이벤트 생성 (서버 저장) ===
  const fnGenerateQuery = async () => {
    if (!objSelectedEvent) return;

    // 실행 날짜 필수 체크
    if (!strExecDate) {
      messageApi.warning('이벤트 실행 날짜를 선택해주세요.');
      return;
    }

    // 입력값 필요한데 비어있으면 경고
    if (objSelectedEvent.strInputFormat !== 'none' && !strInputValues.trim()) {
      messageApi.warning('입력값을 입력해주세요.');
      return;
    }

    let strQuery = objSelectedEvent.strQueryTemplate;

    // 치환 변수 처리
    strQuery = strQuery.replace(/\{\{items\}\}/g, strInputValues.trim());
    strQuery = strQuery.replace(/\{\{date\}\}/g, strExecDate);
    strQuery = strQuery.replace(/\{\{event_name\}\}/g, strEventName);
    strQuery = strQuery.replace(/\{\{abbr\}\}/g, strSelectedAbbr || '');
    strQuery = strQuery.replace(/\{\{product\}\}/g, objSelectedProduct?.strName || '');
    strQuery = strQuery.replace(/\{\{region\}\}/g, objSelectedService?.strRegion || '');

    setStrGeneratedQuery(strQuery);

    // 서버에 이벤트 인스턴스 저장
    setBSubmitting(true);
    try {
      const objResult = await fnApiCreateInstance({
        nEventTemplateId: objSelectedEvent.nId,
        strEventLabel: objSelectedEvent.strEventLabel,
        strProductName: objSelectedProduct?.strName || '',
        strServiceAbbr: strSelectedAbbr || '',
        strServiceRegion: objSelectedService?.strRegion || '',
        strCategory: objSelectedEvent.strCategory,
        strType: objSelectedEvent.strType,
        strEventName,
        strInputValues: strInputValues.trim(),
        strGeneratedQuery: strQuery,
        dtExecDate: strExecDate,
        strCreatedBy: user?.strDisplayName || '',
      });

      if (objResult.bSuccess) {
        messageApi.success('이벤트가 생성되었습니다! 대시보드에서 진행 상태를 확인하세요.');
      } else {
        messageApi.error(objResult.strMessage || '이벤트 생성에 실패했습니다.');
      }
    } catch {
      messageApi.error('서버 연결에 실패했습니다.');
    } finally {
      setBSubmitting(false);
    }
  };

  // 클립보드 복사
  const fnCopyToClipboard = () => {
    navigator.clipboard.writeText(strGeneratedQuery);
    messageApi.success('클립보드에 복사되었습니다.');
  };

  // 전체 초기화
  const fnReset = () => {
    setNSelectedProductId(null);
    setStrSelectedAbbr(null);
    setNSelectedEventId(null);
    setStrEventName('');
    setStrInputValues('');
    setStrExecDate('');
    setStrGeneratedQuery('');
  };

  // 입력 형식에 맞는 placeholder
  const fnGetInputPlaceholder = (): string => {
    if (!objSelectedEvent) return '';
    switch (objSelectedEvent.strInputFormat) {
      case 'item_number':
        return '아이템 번호를 쉼표로 구분하여 입력\n예: 7902, 9471, 9138, 11582';
      case 'item_string':
        return '아이템 문자열을 줄바꿈으로 구분하여 입력\n예:\n2012_yuki_giftbox\n2012_yuki_ticket';
      case 'date':
        return '날짜를 입력하세요\n예: 20251125';
      default:
        return '';
    }
  };

  // 이벤트가 없을 때
  if (arrProducts.length === 0 || arrEvents.length === 0) {
    return (
      <>
        {contextHolder}
        <Title level={4} style={{ marginBottom: 24 }}>
          <CodeOutlined /> 이벤트 생성
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

  return (
    <>
      {contextHolder}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          <CodeOutlined /> 이벤트 생성
        </Title>
        {nSelectedProductId && (
          <Button icon={<ReloadOutlined />} onClick={fnReset}>초기화</Button>
        )}
      </div>

      {/* 진행 단계 */}
      <Card style={{ marginBottom: 24 }}>
        <Steps
          current={nCurrentStep}
          items={[
            { title: '프로덕트' },
            { title: '서비스 선택' },
            { title: '이벤트 선택' },
            { title: '값 입력' },
            { title: '완료', icon: strGeneratedQuery ? <CheckCircleOutlined /> : undefined },
          ]}
        />
      </Card>

      <Row gutter={24}>
        {/* 왼쪽: 조건 입력 */}
        <Col xs={24} lg={10}>
          {/* STEP 1: 프로덕트 선택 */}
          <Card title="1. 프로덕트 선택" size="small">
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
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                    ({p.arrServices.map((s) => s.strAbbr).join(', ')})
                  </Text>
                </Select.Option>
              ))}
            </Select>
          </Card>

          {/* STEP 2: 서비스 범위 선택 */}
          {objSelectedProduct && objSelectedProduct.arrServices.length > 1 && (
            <Card title="2. 서비스 범위 선택" size="small" style={{ marginTop: 12 }}>
              <Select
                style={{ width: '100%' }}
                placeholder="서비스 범위를 선택하세요"
                onChange={fnHandleServiceChange}
                value={strSelectedAbbr}
                size="large"
              >
                {objSelectedProduct.arrServices.map((s) => (
                  <Select.Option key={s.strAbbr} value={s.strAbbr}>
                    <strong>{s.strAbbr}</strong>
                    <Text type="secondary" style={{ marginLeft: 8 }}>({s.strRegion})</Text>
                  </Select.Option>
                ))}
              </Select>
            </Card>
          )}

          {/* STEP 3: 이벤트 선택 */}
          {strSelectedAbbr && (
            <Card title="3. 이벤트 선택" size="small" style={{ marginTop: 12 }}>
              <Select
                style={{ width: '100%' }}
                placeholder="이벤트를 선택하세요"
                onChange={fnHandleEventChange}
                value={nSelectedEventId}
                size="large"
              >
                {arrFilteredEvents.map((e) => (
                  <Select.Option key={e.nId} value={e.nId}>
                    {e.strEventLabel}
                    <Space style={{ marginLeft: 8 }}>
                      <Tag color="blue" style={{ fontSize: 11 }}>{e.strCategory}</Tag>
                      <Tag color="red" style={{ fontSize: 11 }}>{e.strType}</Tag>
                    </Space>
                  </Select.Option>
                ))}
              </Select>
              {objSelectedEvent?.strDescription && (
                <Alert
                  message={objSelectedEvent.strDescription}
                  type="info"
                  showIcon
                  style={{ marginTop: 8 }}
                />
              )}
            </Card>
          )}

          {/* STEP 4: 값 입력 */}
          {objSelectedEvent && (
            <Card title="4. 이벤트 정보 입력" size="small" style={{ marginTop: 12 }}>
              <Form layout="vertical">
                {/* 담당자 (자동) */}
                <Form.Item label="담당자 (생성자)">
                  <Input
                    value={user?.strDisplayName || ''}
                    disabled
                    size="large"
                  />
                </Form.Item>

                {/* 이벤트 이름 (자동 생성, 수정 가능) */}
                <Form.Item label="이벤트 이름">
                  <Input
                    value={strEventName}
                    onChange={(e) => setStrEventName(e.target.value)}
                    placeholder="[약자] 날짜, 이벤트 설명"
                    size="large"
                  />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    자동 생성됩니다. 필요시 수정 가능합니다.
                  </Text>
                </Form.Item>

                {/* 실행 날짜 (필수) */}
                <Form.Item
                  label={
                    <Space>이벤트 실행 날짜 <Tag color="red" style={{ fontSize: 11 }}>필수</Tag></Space>
                  }
                >
                  <DatePicker
                    style={{ width: '100%' }}
                    placeholder="실행 날짜를 선택하세요"
                    onChange={(date) => setStrExecDate(date ? date.format('YYYY-MM-DD') : '')}
                    size="large"
                  />
                </Form.Item>

                {/* 입력값 (형식에 따라) */}
                {objSelectedEvent.strInputFormat !== 'none' && (
                  <Form.Item
                    label={
                      <Space>
                        {objSelectedEvent.strInputFormat === 'item_number' && '아이템 번호'}
                        {objSelectedEvent.strInputFormat === 'item_string' && '아이템 문자열'}
                        {objSelectedEvent.strInputFormat === 'date' && '날짜값'}
                        <Tag color="red" style={{ fontSize: 11 }}>필수</Tag>
                      </Space>
                    }
                  >
                    <TextArea
                      value={strInputValues}
                      onChange={(e) => setStrInputValues(e.target.value)}
                      rows={objSelectedEvent.strInputFormat === 'item_string' ? 8 : 4}
                      placeholder={fnGetInputPlaceholder()}
                      style={{ fontFamily: 'monospace', fontSize: 13 }}
                    />
                  </Form.Item>
                )}
              </Form>

              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={fnGenerateQuery}
                loading={bSubmitting}
                block
                size="large"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  height: 48,
                  fontWeight: 600,
                  fontSize: 16,
                }}
              >
                이벤트 생성
              </Button>
            </Card>
          )}
        </Col>

        {/* 오른쪽: 결과 */}
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
              <>
                {/* 이벤트 이름 표시 */}
                <Alert
                  message={
                    <Space>
                      <Text strong>이벤트:</Text>
                      <Text>{strEventName}</Text>
                    </Space>
                  }
                  type="success"
                  showIcon
                  style={{ marginBottom: 12 }}
                />
                <TextArea
                  value={strGeneratedQuery}
                  readOnly
                  autoSize={{ minRows: 10, maxRows: 25 }}
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
              </>
            ) : (
              <div style={{ padding: '80px 0', textAlign: 'center', color: '#bfbfbf' }}>
                <CodeOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <br />
                왼쪽에서 프로덕트와 이벤트를 선택하고
                <br />
                필요한 값을 입력하면 이벤트가 생성됩니다.
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 이력은 대시보드에서 확인 */}
    </>
  );
};

export default QueryPage;
