import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Typography, Card, Tag, message, Form, Select, Button, Space, DatePicker, Pagination, Switch, Modal,
} from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import AppTable, { fnMakeIndexColumn } from '../components/AppTable';
import {
  fnApiClearActivityLogs,
  fnApiGetActivityActors,
  fnApiGetActivityLogs,
  type IActivityActorOption,
  type IActivityLogRow,
  type TActivityCategory,
} from '../api/activityApi';
import { useActivityLogStream } from '../hooks/useActivityLogStream';
import { useAuthStore } from '../stores/useAuthStore';

const { Title, Text } = Typography;

type TCategoryFilter = 'all' | TActivityCategory;

const OBJ_CATEGORY_LABEL: Record<TCategoryFilter, string> = {
  all: '전체',
  auth: '인증',
  event: '이벤트',
  user: '사용자',
  ops: '운영',
  other: '기타',
};

const OBJ_METHOD_COLOR: Record<string, string> = {
  GET: 'blue',
  POST: 'green',
  PUT: 'orange',
  PATCH: 'gold',
  DELETE: 'red',
};

const ARR_METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const ARR_STATUS_OPTIONS = [200, 201, 400, 401, 403, 404, 500] as const;

/** 폼 전용 값 — 선택 시 API에 해당 필터 미전송(모든 활동·HTTP 메서드·행위자·HTTP 상태) */
const STR_FORM_FILTER_ALL = '__all__';

const N_PAGE_SIZE = 100;

/** 활동 시각 필터 기본: 시작 오늘−30일 00:00, 종료 오늘 23:59:59 */
const fnDefaultActivityDtRange = (): [Dayjs, Dayjs] => [
  dayjs().subtract(30, 'day').startOf('day'),
  dayjs().endOf('day'),
];

const fnEncodeActorSelectValue = (o: IActivityActorOption): string =>
  JSON.stringify([o.nActorUserId, o.strActorUserId]);

type TActivityFilter = {
  strCategory: TCategoryFilter;
  strDtFrom?: string;
  strDtTo?: string;
  strMethod?: string;
  nStatusCode?: number;
  bActorNone?: boolean;
  nActorUserId?: number;
  strActorUserId?: string;
};

const fnParseActorSelectValue = (
  strVal: string | undefined,
): Pick<TActivityFilter, 'bActorNone' | 'nActorUserId' | 'strActorUserId'> => {
  if (!strVal || strVal === STR_FORM_FILTER_ALL) return {};
  try {
    const arr = JSON.parse(strVal) as unknown;
    if (!Array.isArray(arr) || arr.length !== 2) return {};
    const [nRaw, sRaw] = arr;
    if (nRaw === null && sRaw === null) return { bActorNone: true };
    const out: Pick<TActivityFilter, 'nActorUserId' | 'strActorUserId'> = {};
    if (nRaw !== null && nRaw !== undefined && String(nRaw) !== '') {
      const n = Number(nRaw);
      if (!Number.isNaN(n)) out.nActorUserId = n;
    }
    if (sRaw !== null && sRaw !== undefined && String(sRaw) !== '') {
      out.strActorUserId = String(sRaw);
    }
    return out;
  } catch {
    return {};
  }
};

const ActivityPage = () => {
  const [form] = Form.useForm();
  const [arrLogs, setArrLogs] = useState<IActivityLogRow[]>([]);
  const [nTotal, setNTotal] = useState(0);
  const [nPage, setNPage] = useState(1);
  const [bLoading, setBLoading] = useState(false);
  const [arrActorOptions, setArrActorOptions] = useState<IActivityActorOption[]>([]);
  const [bRealtime, setBRealtime] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();
  const arrPermissions = useAuthStore((s) => s.user?.arrPermissions ?? []);
  const bCanClearLogs = arrPermissions.includes('activity.clear');

  const [objBootstrap] = useState(() => {
    const [d0, d1] = fnDefaultActivityDtRange();
    return {
      dtStart: d0,
      dtEnd: d1,
      objFilter: {
        strCategory: 'all' as TCategoryFilter,
        strDtFrom: d0.toISOString(),
        strDtTo: d1.toISOString(),
      } satisfies TActivityFilter,
    };
  });

  const [objFilter, setObjFilter] = useState<TActivityFilter>(objBootstrap.objFilter);

  const fnLoad = useCallback(async (objF: TActivityFilter, nPageArg: number, bQuiet = false) => {
    if (!bQuiet) {
      setBLoading(true);
    }
    try {
      const objRes = await fnApiGetActivityLogs({
        strCategory: objF.strCategory,
        strDtFrom: objF.strDtFrom,
        strDtTo: objF.strDtTo,
        strMethod: objF.strMethod,
        bActorNone: objF.bActorNone,
        nActorUserId: objF.nActorUserId,
        strActorUserId: objF.strActorUserId,
        nStatusCode: objF.nStatusCode,
        nLimit: N_PAGE_SIZE,
        nOffset: (nPageArg - 1) * N_PAGE_SIZE,
      });
      if (objRes.bSuccess && objRes.arrLogs) {
        setArrLogs(objRes.arrLogs);
        setNTotal(objRes.nTotal ?? 0);
      } else {
        messageApi.error(objRes.strMessage || '활동 로그를 불러올 수 없습니다.');
      }
    } catch {
      messageApi.error('활동 로그를 불러올 수 없습니다.');
    } finally {
      if (!bQuiet) {
        setBLoading(false);
      }
    }
  }, [messageApi]);

  const refLoadCtx = useRef({
    objFilter: objBootstrap.objFilter,
    nPage: 1,
    fnLoad: null as null | ((f: TActivityFilter, p: number, bQuiet?: boolean) => Promise<void>),
  });
  refLoadCtx.current = { objFilter, nPage, fnLoad };

  // SSE로 신규 로그가 들어오면 최신은 1페이지 상단 — 현재 2페이지만 새로고침하면 목록에 안 보이는 문제 방지
  const fnOnStreamRefresh = useCallback(() => {
    setNPage(1);
    const { objFilter: f, fnLoad: l } = refLoadCtx.current;
    if (l) void l(f, 1, true);
  }, []);

  useActivityLogStream({
    bEnabled: bRealtime,
    fnOnRefresh: fnOnStreamRefresh,
  });

  const fnSubmitSearch = useCallback(() => {
    const v = form.getFieldsValue() as {
      strCategory: TCategoryFilter;
      dtStart: Dayjs | null;
      dtEnd: Dayjs | null;
      strMethod?: string;
      strActorKey?: string;
      nStatusCode?: number | string | null;
    };
    const strDtFrom = v.dtStart?.toISOString();
    const strDtTo = v.dtEnd?.toISOString();
    const strMethod =
      !v.strMethod || v.strMethod === STR_FORM_FILTER_ALL ? undefined : v.strMethod;
    const nStatusRaw = v.nStatusCode;
    const nStatusCode =
      nStatusRaw === STR_FORM_FILTER_ALL
        || nStatusRaw === undefined
        || nStatusRaw === null
        ? undefined
        : Number(nStatusRaw);
    const objActor = fnParseActorSelectValue(v.strActorKey);
    const next: TActivityFilter = {
      strCategory: v.strCategory || 'all',
      strDtFrom,
      strDtTo,
      strMethod,
      nStatusCode: nStatusCode != null && !Number.isNaN(nStatusCode) ? nStatusCode : undefined,
      ...objActor,
    };
    setObjFilter(next);
    setNPage(1);
    void fnLoad(next, 1);
  }, [form, fnLoad]);

  useEffect(() => {
    void fnLoad(objBootstrap.objFilter, 1);
  }, [fnLoad, objBootstrap.objFilter]);

  useEffect(() => {
    void (async () => {
      const objRes = await fnApiGetActivityActors();
      if (objRes.bSuccess && objRes.arrActors) {
        setArrActorOptions(objRes.arrActors);
      } else {
        console.error('[ActivityPage] 행위자 목록 실패 |', objRes.strMessage);
      }
    })();
  }, []);

  const fnClearAllServerLogs = () => {
    Modal.confirm({
      title: '활동 로그 전체 삭제',
      content: '서버에 저장된 HTTP 활동 로그를 모두 지웁니다. 복구할 수 없습니다. 계속할까요?',
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        try {
          const objRes = await fnApiClearActivityLogs();
          if (objRes.bSuccess) {
            messageApi.success(objRes.strMessage || '삭제했습니다.');
            setNPage(1);
            await fnLoad(objFilter, 1);
            const objActors = await fnApiGetActivityActors();
            if (objActors.bSuccess && objActors.arrActors) setArrActorOptions(objActors.arrActors);
          } else {
            messageApi.error(objRes.strMessage || '삭제에 실패했습니다.');
          }
        } catch (err: unknown) {
          const strMsg =
            err && typeof err === 'object' && 'message' in err
              ? String((err as { message?: string }).message)
              : '삭제 요청에 실패했습니다.';
          messageApi.error(strMsg);
        }
      },
    });
  };

  const fnReset = () => {
    const [d0, d1] = fnDefaultActivityDtRange();
    const next: TActivityFilter = {
      strCategory: 'all',
      strDtFrom: d0.toISOString(),
      strDtTo: d1.toISOString(),
    };
    form.setFieldsValue({
      strCategory: 'all',
      dtStart: d0,
      dtEnd: d1,
      strMethod: STR_FORM_FILTER_ALL,
      strActorKey: STR_FORM_FILTER_ALL,
      nStatusCode: STR_FORM_FILTER_ALL,
    });
    setObjFilter(next);
    setNPage(1);
    void fnLoad(next, 1);
  };

  const arrColumns = [
    fnMakeIndexColumn(),
    {
      title: '시각',
      dataIndex: 'dtAt',
      key: 'dtAt',
      width: 178,
      render: (str: string) => <Text style={{ fontSize: 12 }}>{new Date(str).toLocaleString('ko-KR')}</Text>,
    },
    {
      title: '활동 분류',
      dataIndex: 'strCategory',
      key: 'strCategory',
      width: 96,
      render: (c: TActivityCategory) => (
        <Tag color="geekblue">{OBJ_CATEGORY_LABEL[c]}</Tag>
      ),
    },
    {
      title: 'HTTP 메서드',
      dataIndex: 'strMethod',
      key: 'strMethod',
      width: 100,
      render: (m: string) => <Tag color={OBJ_METHOD_COLOR[m] || 'default'}>{m}</Tag>,
    },
    {
      title: '경로',
      dataIndex: 'strPath',
      key: 'strPath',
      ellipsis: true,
      render: (p: string) => <Text code copyable={{ text: p }} style={{ fontSize: 12 }}>{p}</Text>,
    },
    {
      title: 'HTTP 상태',
      dataIndex: 'nStatusCode',
      key: 'nStatusCode',
      width: 88,
      render: (n: number) => {
        const bOk = n >= 200 && n < 400;
        return <Tag color={bOk ? 'success' : 'error'}>{n}</Tag>;
      },
    },
    {
      title: '역할',
      key: 'roles',
      width: 120,
      render: (_: unknown, r: IActivityLogRow) => (
        <Text style={{ fontSize: 12 }}>
          {r.arrActorRoles != null && r.arrActorRoles.length > 0 ? r.arrActorRoles.join(', ') : '—'}
        </Text>
      ),
    },
    {
      title: '행위자',
      key: 'actor',
      width: 140,
      render: (_: unknown, r: IActivityLogRow) => (
        <Text style={{ fontSize: 12 }}>{r.strActorUserId || (r.nActorUserId != null ? `#${r.nActorUserId}` : '—')}</Text>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <Title level={4} style={{ margin: 0 }}>활동</Title>
          <Space align="center" size="small">
            <Text type="secondary" style={{ fontSize: 12 }}>실시간 갱신</Text>
            <Switch checked={bRealtime} onChange={setBRealtime} />
          </Space>
        </div>
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          HTTP 메서드·경로·응답 코드 기준 기록입니다. 실시간 갱신을 켜 두면 SSE로 신규 로그가 쌓일 때 목록을 다시 불러옵니다. 필터는 시각·활동 분류·HTTP 메서드·행위자·HTTP 상태를 조합해 조회합니다.
        </Text>

        <Form
          form={form}
          layout="vertical"
          initialValues={{
            strCategory: 'all',
            dtStart: objBootstrap.dtStart,
            dtEnd: objBootstrap.dtEnd,
            strMethod: STR_FORM_FILTER_ALL,
            strActorKey: STR_FORM_FILTER_ALL,
            nStatusCode: STR_FORM_FILTER_ALL,
          }}
          style={{ marginBottom: 16 }}
        >
          <Space wrap align="start" size="middle">
            <Form.Item name="dtStart" label="시작 시각" style={{ marginBottom: 0 }}>
              <DatePicker showTime style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="dtEnd" label="종료 시각" style={{ marginBottom: 0 }}>
              <DatePicker showTime style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="strCategory" label="활동 분류" style={{ marginBottom: 0 }}>
              <Select
                style={{ width: 120 }}
                options={(Object.keys(OBJ_CATEGORY_LABEL) as TCategoryFilter[]).map((k) => ({
                  value: k,
                  label: OBJ_CATEGORY_LABEL[k],
                }))}
              />
            </Form.Item>
            <Form.Item name="strMethod" label="HTTP 메서드" style={{ marginBottom: 0 }}>
              <Select
                style={{ width: 120 }}
                options={[
                  { value: STR_FORM_FILTER_ALL, label: '전체' },
                  ...ARR_METHOD_OPTIONS.map((m) => ({ value: m, label: m })),
                ]}
              />
            </Form.Item>
            <Form.Item name="strActorKey" label="행위자" style={{ marginBottom: 0 }}>
              <Select
                style={{ width: 200 }}
                options={[
                  { value: STR_FORM_FILTER_ALL, label: '전체' },
                  ...arrActorOptions.map((o) => ({
                    value: fnEncodeActorSelectValue(o),
                    label: o.strLabel,
                  })),
                ]}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item name="nStatusCode" label="HTTP 상태" style={{ marginBottom: 0 }}>
              <Select
                style={{ width: 110 }}
                options={[
                  { value: STR_FORM_FILTER_ALL, label: '전체' },
                  ...ARR_STATUS_OPTIONS.map((n) => ({ value: n, label: String(n) })),
                ]}
              />
            </Form.Item>
            <Form.Item label=" " style={{ marginBottom: 0 }}>
              <Space>
                <Button type="primary" onClick={() => fnSubmitSearch()}>
                  조회
                </Button>
                <Button onClick={fnReset}>필터 초기화</Button>
                {bCanClearLogs ? (
                  <Button danger onClick={fnClearAllServerLogs}>
                    서버 로그 전체 삭제
                  </Button>
                ) : null}
              </Space>
            </Form.Item>
          </Space>
        </Form>

        <AppTable
          rowKey="nId"
          loading={bLoading}
          columns={arrColumns}
          dataSource={arrLogs}
          pagination={false}
          size="small"
          strEmptyText="기록이 없습니다."
        />
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            필터 적용 후 총 {nTotal}건
          </Text>
          <Pagination
            current={nPage}
            pageSize={N_PAGE_SIZE}
            total={nTotal}
            showSizeChanger={false}
            onChange={(p) => {
              setNPage(p);
              void fnLoad(objFilter, p);
            }}
            disabled={bLoading}
            showTotal={(t) => `${t}건 중 ${Math.min((nPage - 1) * N_PAGE_SIZE + 1, t)}–${Math.min(nPage * N_PAGE_SIZE, t)}`}
          />
        </div>
      </Card>
    </>
  );
};

export default ActivityPage;
