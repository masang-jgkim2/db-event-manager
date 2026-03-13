import { useState, useMemo, useEffect } from 'react';
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
  Checkbox,
} from 'antd';
import {
  CodeOutlined,
  CopyOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useProductStore } from '../stores/useProductStore';
import { useEventStore } from '../stores/useEventStore';
import { useAuthStore } from '../stores/useAuthStore';
import { fnApiCreateInstance } from '../api/eventInstanceApi';
import { fnApiGetDbConnections } from '../api/dbConnectionApi';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import type { IEventTemplate, IService, TDeployScope } from '../types';
import type { IDbConnection } from '../types';
import { ARR_DEPLOY_SCOPE_OPTIONS } from '../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

const QueryPage = () => {
  const navigate = useNavigate();
  // 선택 상태
  const [nSelectedProductId, setNSelectedProductId] = useState<number | null>(null);
  const [strSelectedAbbr, setStrSelectedAbbr] = useState<string | null>(null);
  const [nSelectedEventId, setNSelectedEventId] = useState<number | null>(null);

  // 입력 상태
  const [strEventName, setStrEventName] = useState('');
  const [strInputValues, setStrInputValues] = useState('');
  const [strDeployDate, setStrDeployDate] = useState('');  // 반영 날짜 (ISO 8601)

  // 단일 서버(한 환경) vs 다중 서버(QA+LIVE) — QA/LIVE 체크박스로 선택 (선택 시 해당 프로덕트에 해당 env DB 접속 있어야 함)
  const [arrDeployScope, setArrDeployScope] = useState<TDeployScope[]>(['qa', 'live']);

  // DB 접속 목록 (이벤트 생성 시 QA/LIVE 선택 가능 여부 검사용)
  const [arrDbConnections, setArrDbConnections] = useState<IDbConnection[]>([]);

  // 결과
  const [strGeneratedQuery, setStrGeneratedQuery] = useState('');

  const [messageApi, contextHolder] = message.useMessage();

  const [bSubmitting, setBSubmitting] = useState(false);

  const arrProducts = useProductStore((s) => s.arrProducts);
  const fnFetchProducts = useProductStore((s) => s.fnFetchProducts);
  const arrEvents = useEventStore((s) => s.arrEvents);
  const fnFetchEvents = useEventStore((s) => s.fnFetchEvents);
  const user = useAuthStore((s) => s.user);

  // 페이지 진입 시 최신 프로덕트/이벤트 목록 및 DB 접속 목록 로드
  useEffect(() => { fnFetchProducts(); fnFetchEvents(); }, [fnFetchProducts, fnFetchEvents]);
  useEffect(() => {
    let bMounted = true;
    const fnLoad = async () => {
      try {
        const res = await fnApiGetDbConnections();
        if (bMounted && res?.bSuccess && Array.isArray(res.arrDbConnections))
          setArrDbConnections(res.arrDbConnections);
      } catch {
        // 권한 없음 등 실패해도 페이지는 표시
      }
    };
    fnLoad();
    return () => { bMounted = false; };
  }, []);
  useAutoRefresh(() => { fnFetchProducts(); fnFetchEvents(); });

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

  // 선택된 프로덕트의 DB 접속 중 QA/LIVE 활성 접속 존재 여부 (이벤트 생성 시 QA/LIVE 체크 가능 여부)
  const bHasQaConnection = useMemo(() => {
    if (!nSelectedProductId) return false;
    return arrDbConnections.some((c) => c.nProductId === nSelectedProductId && c.strEnv === 'qa' && c.bIsActive);
  }, [nSelectedProductId, arrDbConnections]);
  const bHasLiveConnection = useMemo(() => {
    if (!nSelectedProductId) return false;
    return arrDbConnections.some((c) => c.nProductId === nSelectedProductId && c.strEnv === 'live' && c.bIsActive);
  }, [nSelectedProductId, arrDbConnections]);

  // 프로덕트 선택 시: 쿼리 실행 대상에서 해당 프로덕트에 접속이 없는 env 제거
  useEffect(() => {
    if (nSelectedProductId == null) return;
    setArrDeployScope((prev) => {
      const next = prev.filter((env) =>
        (env === 'qa' && bHasQaConnection) || (env === 'live' && bHasLiveConnection)
      );
      return next.length > 0 ? next : (bHasQaConnection ? ['qa'] : bHasLiveConnection ? ['live'] : []);
    });
  }, [nSelectedProductId, bHasQaConnection, bHasLiveConnection]); // eslint-disable-line react-hooks/exhaustive-deps

  // 현재 스텝
  const nCurrentStep = useMemo(() => {
    if (strGeneratedQuery) return 4;
    if (nSelectedEventId) return 3;
    if (strSelectedAbbr) return 2;
    if (nSelectedProductId) return 1;
    return 0;
  }, [nSelectedProductId, strSelectedAbbr, nSelectedEventId, strGeneratedQuery]);

  // 이벤트 이름 자동 생성 - [약자앞부분] 날짜, 설명
  // 예: DK/KR → [DK], AO/EU → [AO], FH → [FH]
  const fnGenerateEventName = (strAbbr: string, strEventLabel: string) => {
    const strShortAbbr = strAbbr.includes('/') ? strAbbr.split('/')[0] : strAbbr;
    const strToday = dayjs().format('M월 D일');
    return `[${strShortAbbr}] ${strToday}, ${strEventLabel}`;
  };

  // === 선택 핸들러 ===
  const fnHandleProductChange = (nId: number) => {
    setNSelectedProductId(nId);
    setStrSelectedAbbr(null);
    setNSelectedEventId(null);
    setStrEventName('');
    setStrInputValues('');
    setStrDeployDate('');
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
    setStrDeployDate('');
    setStrGeneratedQuery('');
  };

  const fnHandleEventChange = (nId: number) => {
    setNSelectedEventId(nId);
    setStrGeneratedQuery('');

    const objEvent = arrEvents.find((e) => e.nId === nId);
    if (objEvent && strSelectedAbbr) {
      // 이벤트 이름 자동 생성
      setStrEventName(fnGenerateEventName(strSelectedAbbr, objEvent.strEventLabel));

      // 기본 아이템값: 템플릿 공통값 우선, 없으면 세트가 있을 때 첫 세트 기본값 사용
      const strDefault =
        (objEvent.strDefaultItems && objEvent.strDefaultItems.trim()) ||
        (objEvent.arrQueryTemplates?.[0]?.strDefaultItems?.trim()) ||
        '';
      setStrInputValues(strDefault);
    }

  };

  // 치환 적용 헬퍼 (템플릿 문자열 + 입력값 → 최종 쿼리)
  const fnApplyTemplate = (strTemplate: string): string => {
    const strDateOnly = strDeployDate.slice(0, 10);
    let str = strTemplate;
    str = str.replace(/\{\{items\}\}/g, strInputValues.trim());
    str = str.replace(/\{\{date\}\}/g, strDateOnly);
    str = str.replace(/\{\{event_name\}\}/g, strEventName);
    str = str.replace(/\{\{abbr\}\}/g, strSelectedAbbr || '');
    str = str.replace(/\{\{product\}\}/g, objSelectedProduct?.strName || '');
    str = str.replace(/\{\{region\}\}/g, objSelectedService?.strRegion || '');
    return str;
  };

  // === 이벤트 생성 (템플릿 + 입력값만 사용, 서버 저장) ===
  const fnGenerateQuery = async () => {
    if (!objSelectedEvent) return;

    // 반영 날짜 필수 체크
    if (!strDeployDate) {
      messageApi.warning('반영 날짜를 선택해주세요.');
      return;
    }

    // 쿼리 실행 대상(QA/LIVE) 선택 시 해당 프로덕트에 그 env DB 접속이 있는지 검사
    if (arrDeployScope.includes('qa') && !bHasQaConnection) {
      messageApi.warning('QA를 선택하려면 해당 프로덕트에 QA DB 접속 정보를 등록·활성화해주세요.');
      return;
    }
    if (arrDeployScope.includes('live') && !bHasLiveConnection) {
      messageApi.warning('LIVE를 선택하려면 해당 프로덕트에 LIVE DB 접속 정보를 등록·활성화해주세요.');
      return;
    }

    // 입력값 필요한데 비어있으면 경고
    if (objSelectedEvent.strInputFormat !== 'none' && !strInputValues.trim()) {
      messageApi.warning('입력값을 입력해주세요.');
      return;
    }

    const arrQueryTemplates = objSelectedEvent.arrQueryTemplates?.filter((qt) => qt.nDbConnectionId && qt.strQueryTemplate?.trim());
    let strQuery: string;
    let arrExecutionTargets: Array<{ nDbConnectionId: number; strQuery: string }> | undefined;

    if (arrQueryTemplates?.length) {
      // DB 연결별 쿼리 템플릿 사용 — 동일 입력값으로 각 템플릿 치환
      arrExecutionTargets = arrQueryTemplates.map((qt) => ({
        nDbConnectionId: qt.nDbConnectionId,
        strQuery: fnApplyTemplate(qt.strQueryTemplate),
      }));
      strQuery = arrExecutionTargets.map((t) => t.strQuery).join('\n;\n');
    } else {
      // 단일 쿼리 템플릿
      strQuery = fnApplyTemplate(objSelectedEvent.strQueryTemplate || '');
    }

    setStrGeneratedQuery(strQuery);

    // 서버에 이벤트 인스턴스 저장 (템플릿 기반 생성 쿼리만 전달)
    setBSubmitting(true);
    try {
      const objPayload: Record<string, unknown> = {
        nEventTemplateId: objSelectedEvent.nId,
        nProductId: objSelectedProduct?.nId || 0,
        strEventLabel: objSelectedEvent.strEventLabel,
        strProductName: objSelectedProduct?.strName || '',
        strServiceAbbr: strSelectedAbbr || '',
        strServiceRegion: objSelectedService?.strRegion || '',
        strCategory: objSelectedEvent.strCategory,
        strType: objSelectedEvent.strType,
        strEventName,
        strInputValues: strInputValues.trim(),
        strGeneratedQuery: strQuery,
        dtDeployDate: strDeployDate,
        arrDeployScope,
        strCreatedBy: user?.strDisplayName || '',
      };
      if (arrExecutionTargets?.length) {
        objPayload.arrExecutionTargets = arrExecutionTargets;
      }

      const objResult = await fnApiCreateInstance(objPayload);

      if (objResult.bSuccess) {
        messageApi.success('이벤트가 생성되었습니다!');
        // 2초 후 나의 대시보드로 이동
        setTimeout(() => navigate('/my-dashboard'), 1500);
      } else {
        messageApi.error(objResult.strMessage || '이벤트 생성에 실패했습니다.');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '서버 연결에 실패했습니다.');
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
    setStrDeployDate('');
    setStrGeneratedQuery('');
    setArrDeployScope(['qa', 'live']);
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

  const arrUserRoles = user?.arrRoles || [];
  const arrUserPermissions = user?.arrPermissions || [];

  // 이벤트 생성 보기/생성 권한이 없으면 접근 차단 (보기만 있어도 페이지 진입 가능)
  const bCanView = arrUserPermissions.includes('instance.view') || arrUserPermissions.includes('instance.create');
  if (!bCanView) {
    return (
      <Card>
        <Result status="403" title="접근 권한 없음" subTitle="이벤트 생성(보기) 권한이 없습니다. 나의 대시보드를 이용해주세요." />
      </Card>
    );
  }
  const bCanCreate = arrUserPermissions.includes('instance.create');

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
              arrUserRoles.includes('admin')
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
            { title: '국내/해외' },
            { title: '이벤트 선택' },
            { title: '값 입력' },
            { title: '생성 완료', icon: strGeneratedQuery ? <CheckCircleOutlined /> : undefined },
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

          {/* STEP 2: 국내/해외 선택 */}
          {objSelectedProduct && (
            <Card title="2. 국내/해외 선택" size="small" style={{ marginTop: 12 }}>
              <Select
                style={{ width: '100%' }}
                placeholder="국내/해외를 선택하세요"
                onChange={fnHandleServiceChange}
                value={strSelectedAbbr}
                size="large"
              >
                {objSelectedProduct.arrServices.map((s) => {
                  // 리전 라벨 매핑: 국내(한국), 글로벌→해외(글로벌), 스팀→해외(스팀)
                  let strDisplayLabel = s.strRegion;
                  if (s.strRegion === '국내') strDisplayLabel = '국내(한국)';
                  else if (s.strRegion === '글로벌') strDisplayLabel = '해외(글로벌)';
                  else if (s.strRegion === '스팀') strDisplayLabel = '해외(스팀)';
                  else if (s.strRegion === '유럽') strDisplayLabel = '해외(유럽)';
                  else if (s.strRegion === '일본') strDisplayLabel = '해외(일본)';

                  return (
                    <Select.Option key={s.strAbbr} value={s.strAbbr}>
                      {strDisplayLabel}
                      <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                        {s.strAbbr}
                      </Text>
                    </Select.Option>
                  );
                })}
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

                {/* 반영 날짜 (필수, 날짜+시분초) */}
                <Form.Item
                  label={
                    <Space>
                      반영 날짜
                      <Tag color="red" style={{ fontSize: 11 }}>필수</Tag>
                      <Text type="secondary" style={{ fontSize: 11 }}>DEV/QA: 이 시각 이전에 실행, LIVE: 이 시각 이후에 실행</Text>
                    </Space>
                  }
                >
                  <DatePicker
                    style={{ width: '100%' }}
                    showTime={{ format: 'HH:mm:ss' }}
                    format="YYYY-MM-DD HH:mm:ss"
                    placeholder="반영 날짜/시각을 선택하세요"
                    onChange={(date) => setStrDeployDate(date ? date.toISOString() : '')}
                    size="large"
                  />
                </Form.Item>

                {/* 쿼리 실행 대상: QA/LIVE 선택 시 해당 프로덕트에 그 env DB 접속이 있어야 함 */}
                <Form.Item
                  label={
                    <Space>
                      쿼리 실행 대상
                      <Tag color="red" style={{ fontSize: 11 }}>필수</Tag>
                    </Space>
                  }
                  extra={
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      QA/LIVE 선택 시 해당 프로덕트에 해당 환경 DB 접속이 등록·활성화되어 있어야 합니다. 단일 서버: 한 환경만 선택. 다중 서버: QA와 LIVE 둘 다 선택 시 QA 반영 후 LIVE 순으로 실행됩니다.
                    </Text>
                  }
                >
                  <Checkbox.Group
                    value={arrDeployScope}
                    onChange={(arrChecked) => {
                      const arrNext = (arrChecked as TDeployScope[]).filter((v) => {
                        if (v !== 'qa' && v !== 'live') return false;
                        return (v === 'qa' && bHasQaConnection) || (v === 'live' && bHasLiveConnection);
                      });
                      if (arrNext.length > 0) setArrDeployScope(arrNext);
                    }}
                  >
                    <Space>
                      {ARR_DEPLOY_SCOPE_OPTIONS.map((opt) => (
                        <Checkbox
                          key={opt.value}
                          value={opt.value}
                          disabled={opt.value === 'qa' ? !bHasQaConnection : !bHasLiveConnection}
                        >
                          <Tag color={opt.strColor}>{opt.label}</Tag>
                          {(opt.value === 'qa' && !bHasQaConnection) || (opt.value === 'live' && !bHasLiveConnection) ? (
                            <Text type="secondary" style={{ fontSize: 11 }}> (해당 프로덕트에 {opt.value.toUpperCase()} DB 접속 없음)</Text>
                          ) : null}
                        </Checkbox>
                      ))}
                    </Space>
                  </Checkbox.Group>
                </Form.Item>

                {/* 쿼리 템플릿에 맞는 입력 공간 (템플릿에 따라 한 개 또는 여러 개) */}
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
                    extra={
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        쿼리 템플릿에 맞게 입력할 수 있는 공간은 템플릿에 따라 한 개일 수도 여러 개일 수 있습니다.
                      </Text>
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

              {bCanCreate ? (
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
              ) : (
                <div style={{ padding: '12px 0', color: 'var(--ant-color-text-secondary)', fontSize: 13 }}>
                  이벤트 생성(제출) 권한이 없습니다. 보기만 가능합니다.
                </div>
              )}
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
