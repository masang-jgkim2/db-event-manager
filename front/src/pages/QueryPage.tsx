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
  Steps,
  Result,
  Alert,
  Checkbox,
  Tabs,
  theme,
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
import { useDbConnectionStore } from '../stores/useDbConnectionStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useThemeStore, fnGenPalette } from '../stores/useThemeStore';
import { DqpmTag } from '../components/DqpmTag';
import { QuerySetInputSlotRows } from '../components/QuerySetInputSlotRows';
import { fnApiCreateInstance } from '../api/eventInstanceApi';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import type { IEventTemplate, IService, TDeployScope, TTemplateStatus, TInputFormat } from '../types';
import { ARR_DEPLOY_SCOPE_OPTIONS, OBJ_TEMPLATE_STATUS_CONFIG } from '../types';
import { fnReplaceItemsInTemplate, fnReplaceAllInputsInTemplate } from '../utils/queryTemplateItems';
import { fnEncodeInstanceInputValues } from '../utils/instanceInputValues';
import { fnNormalizeQuerySetInputs } from '../utils/querySetInput';
import {
  fnBuildInstanceConnectionPreview,
  fnFormatConnectionEndpoint,
  fnFormatExecutionTargetConnLabel,
  fnIsExplicitEnvConnectionValid,
  fnIsValidQueryTemplateSet,
  fnIsEventTemplateFkStub,
  fnSummarizeTemplateShape,
  fnNormalizeExecutionTargetItem,
  fnNormalizeQueryTemplateItem,
  fnHasEnvConnectionForService,
  fnServiceHasAnyDeployConnection,
} from '../utils/dbConnectionScope';
import {
  fnFormatCountryPlatformAbbr,
  fnFormatCountryPlatformMessage,
  fnFormatCountryPlatformRegion,
  STR_SERVICE_SCOPE_LABEL,
} from '../utils/countryPlatformLabel';
import { useDesignSystem } from '../styles/DesignSystemContext';
import { fnSqlEditorReadonlyStyle, STR_CODE_BLOCK_CLASS, fnCodeSurfaceStyle } from '../styles/queryEditorTokens';

const { Title, Text } = Typography;
const { TextArea } = Input;

const fnResolveTemplateStatus = (obj: IEventTemplate): TTemplateStatus =>
  obj.strStatus ?? 'dba_confirmed';

/** 리뷰 미완료 템플릿 선택 시 Alert 문구 */
const fnBuildTemplateReviewAlert = (
  obj: IEventTemplate,
): { strType: 'info' | 'warning'; strMessage: string; strDescription: string } | null => {
  const strStatus = fnResolveTemplateStatus(obj);
  if (strStatus === 'dba_confirmed') return null;

  const objLastLog = [...(obj.arrStatusLogs ?? [])]
    .reverse()
    .find((log) => log.strStatus === strStatus);
  const strComment = objLastLog?.strComment?.trim();

  if (strStatus === 'template_created') {
    return {
      strType: 'info',
      strMessage: '템플릿 등록됨 — 쿼리 리뷰 요청 전',
      strDescription:
        strComment
        || '쿼리 템플릿 메뉴에서 「쿼리 리뷰 요청」을 진행해주세요. DBA 리뷰 완료 후 이벤트 생성이 가능합니다.',
    };
  }

  return {
    strType: 'info',
    strMessage: '쿼리 리뷰 요청 중 — DBA 검토 대기',
    strDescription:
      strComment
      || 'DBA가 쿼리 리뷰를 완료하면 이벤트 생성 단계로 진행할 수 있습니다.',
  };
};

const QueryPage = () => {
  const navigate = useNavigate();
  // 선택 상태
  const [nSelectedProductId, setNSelectedProductId] = useState<number | null>(null);
  const [nSelectedServiceId, setNSelectedServiceId] = useState<number | null>(null);
  const [nSelectedEventId, setNSelectedEventId] = useState<number | null>(null);

  // 입력 상태
  const [strEventName, setStrEventName] = useState('');
  const [strInputValues, setStrInputValues] = useState('');
  /** 세트별 슬롯 값 — sets[i][strInputId] */
  const [arrSetSlotValues, setArrSetSlotValues] = useState<Array<Record<string, string>>>([]);
  const [strDeployDate, setStrDeployDate] = useState('');  // 하위 호환용 (미사용)
  const [strQaDeployDate, setStrQaDeployDate] = useState('');   // QA 반영 날짜 (ISO 8601)
  const [strLiveDeployDate, setStrLiveDeployDate] = useState(''); // LIVE 반영 날짜 (ISO 8601)
  const [strAlloLink, setStrAlloLink] = useState('');

  // 단일 서버(한 환경) vs 다중 서버(QA+LIVE) — QA/LIVE 체크박스로 선택 (선택 시 해당 프로덕트에 해당 env DB 접속 있어야 함)
  const [arrDeployScope, setArrDeployScope] = useState<TDeployScope[]>(['qa', 'live']);

  // 결과 (단일: strGeneratedQuery만 사용, 다중: arrExecutionTargets + 미리보기용 strGeneratedQuery)
  const [strGeneratedQuery, setStrGeneratedQuery] = useState('');
  const [arrExecutionTargets, setArrExecutionTargets] = useState<Array<{ nQaDbConnectionId: number; nLiveDbConnectionId: number; strQuery: string }>>([]);

  const [messageApi, contextHolder] = message.useMessage();

  const [bSubmitting, setBSubmitting] = useState(false);

  const arrProducts = useProductStore((s) => s.arrProducts);
  const fnFetchProducts = useProductStore((s) => s.fnFetchProducts);
  const arrEvents = useEventStore((s) => s.arrEvents);
  const fnFetchEvents = useEventStore((s) => s.fnFetchEvents);
  const fnFetchDbConnections = useDbConnectionStore((s) => s.fnFetchDbConnections);
  const arrDbConnections = useDbConnectionStore((s) => s.arrDbConnections);
  const user = useAuthStore((s) => s.user);
  const strPrimaryColor = useThemeStore((s) => s.strPrimaryColor);
  const bIsDark = useThemeStore((s) => s.strMode === 'dark');
  const { token } = theme.useToken();
  const { objTypoRoles } = useDesignSystem();
  const objSqlInputStyle = useMemo(
    () => fnCodeSurfaceStyle(token, objTypoRoles.code.nFontSize),
    [token, objTypoRoles.code.nFontSize],
  );
  const objSqlFormInputStyle = useMemo(
    () => ({
      ...objSqlInputStyle,
      marginTop: 8,
    }),
    [objSqlInputStyle],
  );
  const objSqlReadonlyStyle = useMemo(
    () => fnSqlEditorReadonlyStyle(objTypoRoles.code.nFontSize),
    [objTypoRoles.code.nFontSize],
  );
  const strSubmitGradient = useMemo(() => {
    const arrP = fnGenPalette(strPrimaryColor, bIsDark);
    return `linear-gradient(135deg, ${strPrimaryColor} 0%, ${arrP[7]} 100%)`;
  }, [strPrimaryColor, bIsDark]);

  // 페이지 진입 시 한 effect에서 목록 로드(StrictMode 이중 effect 시에도 스토어 dedupe로 GET 완화)
  useEffect(() => {
    void fnFetchProducts();
    void fnFetchEvents();
    void fnFetchDbConnections();
  }, [fnFetchProducts, fnFetchEvents, fnFetchDbConnections]);
  useAutoRefresh(() => {
    fnFetchProducts();
    fnFetchEvents();
    void fnFetchDbConnections();
  });

  // 선택된 프로덕트
  const objSelectedProduct = useMemo(() => {
    return arrProducts.find((p) => p.nId === nSelectedProductId) || null;
  }, [nSelectedProductId, arrProducts]);

  // 선택된 서비스
  const objSelectedService = useMemo((): IService | null => {
    if (!objSelectedProduct || nSelectedServiceId == null) return null;
    return objSelectedProduct.arrServices.find((s) => s.nServiceId === nSelectedServiceId) || null;
  }, [objSelectedProduct, nSelectedServiceId]);

  const strSelectedAbbr = objSelectedService?.strAbbr ?? null;

  // 프로덕트별 템플릿 전체 표시 — DBA 리뷰 완료 건 우선 정렬, 생성은 bTemplateReady 로만 허용
  const arrProductTemplates = useMemo(() => {
    if (!nSelectedProductId) return [];
    return arrEvents
      .filter((e) => e.nProductId === nSelectedProductId)
      .sort((a, b) => {
        const bAReady = fnResolveTemplateStatus(a) === 'dba_confirmed' ? 0 : 1;
        const bBReady = fnResolveTemplateStatus(b) === 'dba_confirmed' ? 0 : 1;
        if (bAReady !== bBReady) return bAReady - bBReady;
        return b.nId - a.nId;
      });
  }, [nSelectedProductId, arrEvents]);

  const nReadyTemplateCount = useMemo(
    () => arrProductTemplates.filter(
      (e) => fnResolveTemplateStatus(e) === 'dba_confirmed' && !fnIsEventTemplateFkStub(e),
    ).length,
    [arrProductTemplates],
  );

  // 선택된 쿼리 템플릿
  const objSelectedEvent: IEventTemplate | null = useMemo(() => {
    if (!nSelectedEventId) return null;
    return arrEvents.find((e) => e.nId === nSelectedEventId) || null;
  }, [nSelectedEventId, arrEvents]);

  const bTemplateReady = objSelectedEvent
    ? fnResolveTemplateStatus(objSelectedEvent) === 'dba_confirmed' && !fnIsEventTemplateFkStub(objSelectedEvent)
    : false;

  // 유효한 쿼리 세트 (세트 2개 이상 = 다중, 1개 = 단일)
  const arrSets = useMemo(() => {
    if (!objSelectedEvent) return [];
    return objSelectedEvent.arrQueryTemplates?.filter((s) => fnIsValidQueryTemplateSet(s)) ?? [];
  }, [objSelectedEvent]);

  // 이벤트 생성 시 QA/LIVE 체크: 프로덕트 + 서비스 범위 + (다중 세트 시) 종류별
  const bHasQaConnection = useMemo(() => {
    if (arrDbConnections.length === 0) return true;
    if (!nSelectedProductId || nSelectedServiceId == null) return true;
    if (arrSets.length > 0) {
      return arrSets.every((s) => {
        const objNorm = fnNormalizeQueryTemplateItem(s);
        return fnIsExplicitEnvConnectionValid(
          arrDbConnections,
          nSelectedProductId,
          objNorm.nQaDbConnectionId,
          'qa',
          strSelectedAbbr ?? '',
          nSelectedServiceId,
        );
      });
    }
    return fnHasEnvConnectionForService(
      arrDbConnections,
      nSelectedProductId,
      strSelectedAbbr ?? '',
      'qa',
      nSelectedServiceId,
    );
  }, [nSelectedProductId, nSelectedServiceId, strSelectedAbbr, arrDbConnections, arrSets]);
  const bHasLiveConnection = useMemo(() => {
    if (arrDbConnections.length === 0) return true;
    if (!nSelectedProductId || nSelectedServiceId == null) return true;
    if (arrSets.length > 0) {
      return arrSets.every((s) => {
        const objNorm = fnNormalizeQueryTemplateItem(s);
        return fnIsExplicitEnvConnectionValid(
          arrDbConnections,
          nSelectedProductId,
          objNorm.nLiveDbConnectionId,
          'live',
          strSelectedAbbr ?? '',
          nSelectedServiceId,
        );
      });
    }
    return fnHasEnvConnectionForService(
      arrDbConnections,
      nSelectedProductId,
      strSelectedAbbr ?? '',
      'live',
      nSelectedServiceId,
    );
  }, [nSelectedProductId, nSelectedServiceId, strSelectedAbbr, arrDbConnections, arrSets]);

  // 프로덕트·서비스 선택 시: 쿼리 실행 대상에서 접속 없는 env 제거
  useEffect(() => {
    if (nSelectedProductId == null || nSelectedServiceId == null) return;
    setArrDeployScope((prev) => {
      const next = prev.filter((env) =>
        (env === 'qa' && bHasQaConnection) || (env === 'live' && bHasLiveConnection)
      );
      return next.length > 0 ? next : (bHasQaConnection ? ['qa'] : bHasLiveConnection ? ['live'] : []);
    });
  }, [nSelectedProductId, nSelectedServiceId, bHasQaConnection, bHasLiveConnection]); // eslint-disable-line react-hooks/exhaustive-deps

  const arrConnectionPreview = useMemo(() => {
    if (!nSelectedProductId || nSelectedServiceId == null || !objSelectedEvent) return [];
    return fnBuildInstanceConnectionPreview(
      arrDbConnections,
      nSelectedProductId,
      strSelectedAbbr ?? '',
      arrDeployScope,
      arrSets,
      nSelectedServiceId,
    );
  }, [nSelectedProductId, nSelectedServiceId, strSelectedAbbr, objSelectedEvent, arrDeployScope, arrSets, arrDbConnections]);

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
    setNSelectedServiceId(null);
    setNSelectedEventId(null);
    setStrEventName('');
    setStrInputValues('');
    setArrSetSlotValues([]);
    setStrDeployDate('');
    setStrQaDeployDate('');
    setStrLiveDeployDate('');
    setStrAlloLink('');
    setStrGeneratedQuery('');

    // 서비스가 1개뿐이고 QA/LIVE 접속이 있으면 자동 선택
    const objProduct = arrProducts.find((p) => p.nId === nId);
    if (objProduct && objProduct.arrServices.length === 1) {
      const objSvc = objProduct.arrServices[0];
      const bCanAuto =
        arrDbConnections.length === 0 ||
        fnServiceHasAnyDeployConnection(
          arrDbConnections,
          nId,
          objSvc.strAbbr,
          objSvc.nServiceId,
        );
      if (bCanAuto && objSvc.nServiceId != null) setNSelectedServiceId(objSvc.nServiceId);
    }
  };

  const fnHandleServiceChange = (nServiceId: number) => {
    setNSelectedServiceId(nServiceId);
    setNSelectedEventId(null);
    setStrEventName('');
    setStrInputValues('');
    setArrSetSlotValues([]);
    setStrDeployDate('');
    setStrQaDeployDate('');
    setStrLiveDeployDate('');
    setStrGeneratedQuery('');
  };

  const fnHandleEventChange = (nId: number) => {
    setNSelectedEventId(nId);
    setStrGeneratedQuery('');
    setArrExecutionTargets([]);

    const objEvent = arrEvents.find((e) => e.nId === nId);
    if (objEvent && strSelectedAbbr) {
      setStrEventName(fnGenerateEventName(strSelectedAbbr, objEvent.strEventLabel));

      const arrNewSets = objEvent.arrQueryTemplates?.filter((s) => fnIsValidQueryTemplateSet(s)) ?? [];
      if (arrNewSets.length >= 1) {
        setArrSetSlotValues(
          arrNewSets.map((s) => {
            const arrSlots = fnNormalizeQuerySetInputs(s, objEvent.strInputFormat);
            const strLegacyFallback =
              (objEvent.strDefaultItems ?? '').trim() || (s.strDefaultItems ?? '').trim();
            const objMap: Record<string, string> = {};
            let bAnySlotDefault = false;
            for (const objSlot of arrSlots) {
              const strSlotDefault = (objSlot.strDefaultItems ?? '').trim();
              objMap[objSlot.strInputId] = strSlotDefault;
              if (strSlotDefault) bAnySlotDefault = true;
            }
            if (!bAnySlotDefault && strLegacyFallback) {
              const objFirstActive =
                arrSlots.find((slot) => slot.strInputFormat !== 'none') ?? arrSlots[0];
              if (objFirstActive) objMap[objFirstActive.strInputId] = strLegacyFallback;
            }
            return objMap;
          }),
        );
        setStrInputValues('');
      } else {
        const strDefault =
          (objEvent.strDefaultItems && objEvent.strDefaultItems.trim()) ||
          '';
        setStrInputValues(strDefault);
        setArrSetSlotValues([]);
      }
    }
  };

  // 치환 적용 — 세트 슬롯 map 또는 레거시 단일 문자열
  const fnApplyTemplate = (
    strTemplate: string,
    objOpts?: {
      arrInputs?: Array<{ strInputId: string; strInputFormat: TInputFormat }>;
      mapValues?: Record<string, string>;
      strItemsOverride?: string;
      strFmtOverride?: string;
      strInputIdOverride?: string;
    },
  ): string => {
    const strDateOnly = (strQaDeployDate || strLiveDeployDate || strDeployDate).slice(0, 10);
    let str: string;
    if (objOpts?.arrInputs?.length && objOpts.mapValues) {
      str = fnReplaceAllInputsInTemplate(strTemplate, objOpts.arrInputs, objOpts.mapValues);
    } else {
      const strRaw = objOpts?.strItemsOverride !== undefined ? objOpts.strItemsOverride : strInputValues;
      const strFmt = (objOpts?.strFmtOverride || objSelectedEvent?.strInputFormat || 'item_number') as TInputFormat;
      const strInputId = objOpts?.strInputIdOverride || 'items';
      str = fnReplaceItemsInTemplate(strTemplate, strRaw, strFmt, strInputId);
    }
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

    if (!bTemplateReady) {
      messageApi.warning('DBA 리뷰가 완료된 쿼리 템플릿만 이벤트를 생성할 수 있습니다.');
      return;
    }

    if (
      objSelectedProduct &&
      objSelectedProduct.arrServices.length > 0 &&
      !(Number(nSelectedServiceId) > 0)
    ) {
      messageApi.warning(`${STR_SERVICE_SCOPE_LABEL}을 선택해주세요.`);
      return;
    }

    // 반영 날짜 필수 체크 — QA 또는 LIVE 중 해당 범위의 날짜가 있어야 함
    const bNeedQa = arrDeployScope.includes('qa');
    const bNeedLive = arrDeployScope.includes('live');
    if (bNeedQa && !strQaDeployDate) {
      messageApi.warning('QA 반영 날짜를 선택해주세요.');
      return;
    }
    if (bNeedLive && !strLiveDeployDate) {
      messageApi.warning('LIVE 반영 날짜를 선택해주세요.');
      return;
    }

    // 쿼리 실행 대상(QA/LIVE) 선택 시 해당 프로덕트에 그 env DB 접속이 있는지 검사
    if (arrDeployScope.includes('qa') && !bHasQaConnection) {
      messageApi.warning(
        strSelectedAbbr
          ? `${fnFormatCountryPlatformMessage(strSelectedAbbr)}에 QA DB 접속(템플릿 종류별)을 등록·활성화해주세요.`
          : 'QA를 선택하려면 해당 프로덕트에 QA DB 접속 정보를 등록·활성화해주세요.',
      );
      return;
    }
    if (arrDeployScope.includes('live') && !bHasLiveConnection) {
      messageApi.warning(
        strSelectedAbbr
          ? `${fnFormatCountryPlatformMessage(strSelectedAbbr)}에 LIVE DB 접속(템플릿 종류별)을 등록·활성화해주세요.`
          : 'LIVE를 선택하려면 해당 프로덕트에 LIVE DB 접속 정보를 등록·활성화해주세요.',
      );
      return;
    }

    // 입력값 검증: 세트·슬롯 (none 제외)
    if (arrSets.length > 0) {
      const bMissing = arrSets.some((s, i) => {
        const objNorm = fnNormalizeQueryTemplateItem(s, objSelectedEvent.strInputFormat);
        const arrSlots = objNorm.arrInputs ?? [];
        const objMap = arrSetSlotValues[i] ?? {};
        return arrSlots.some((objSlot) => {
          if (objSlot.strInputFormat === 'none') return false;
          return !(objMap[objSlot.strInputId] ?? '').trim();
        });
      });
      if (bMissing) {
        messageApi.warning('모든 입력 슬롯 값을 입력해주세요.');
        return;
      }
    } else if (!strInputValues.trim() && (objSelectedEvent.strInputFormat ?? 'item_number') !== 'none') {
      messageApi.warning('입력값을 입력해주세요.');
      return;
    }

    let strQuery = '';
    const arrTargets: Array<{ nQaDbConnectionId: number; nLiveDbConnectionId: number; strQuery: string }> = [];

    if (arrSets.length > 0) {
      for (let i = 0; i < arrSets.length; i++) {
        const s = arrSets[i];
        const objNorm = fnNormalizeQueryTemplateItem(s, objSelectedEvent.strInputFormat);
        const arrSlots = objNorm.arrInputs ?? [];
        const objMap = arrSetSlotValues[i] ?? {};
        const q = fnApplyTemplate(
          (s.strQueryTemplate ?? '').trim(),
          { arrInputs: arrSlots, mapValues: objMap },
        );
        arrTargets.push({
          nQaDbConnectionId: objNorm.nQaDbConnectionId,
          nLiveDbConnectionId: objNorm.nLiveDbConnectionId,
          strQuery: q,
        });
      }
      setArrExecutionTargets(arrTargets);
      strQuery = arrTargets.map((t, idx) => {
        const objNorm = fnNormalizeExecutionTargetItem(t);
        return `-- === 세트 ${idx + 1} (QA #${objNorm.nQaDbConnectionId} / LIVE #${objNorm.nLiveDbConnectionId}) ===\n${t.strQuery}`;
      }).join('\n\n');
    } else {
      const strTemplate = objSelectedEvent.strQueryTemplate?.trim() || '';
      strQuery = fnApplyTemplate(strTemplate);
      setArrExecutionTargets([]);
    }
    setStrGeneratedQuery(strQuery);

    setBSubmitting(true);
    try {
      const strPayloadInputValues = arrSets.length > 0
        ? fnEncodeInstanceInputValues(
          arrSets.map((_, i) => {
            const objNorm = fnNormalizeQueryTemplateItem(arrSets[i], objSelectedEvent.strInputFormat);
            const objMap: Record<string, string> = {};
            for (const objSlot of objNorm.arrInputs ?? []) {
              objMap[objSlot.strInputId] = (arrSetSlotValues[i]?.[objSlot.strInputId] ?? '').trim();
            }
            return objMap;
          }),
        )
        : strInputValues.trim();
      const objPayload: Record<string, unknown> = {
        nEventTemplateId: objSelectedEvent.nId,
        nProductId: objSelectedProduct?.nId || 0,
        nServiceId: nSelectedServiceId ?? undefined,
        strEventLabel: objSelectedEvent.strEventLabel,
        strServiceRegion: objSelectedService?.strRegion || '',
        strCategory: objSelectedEvent.strCategory,
        strType: objSelectedEvent.strType,
        strEventName,
        strAlloLink: strAlloLink.trim() || undefined,
        strInputValues: strPayloadInputValues,
        strGeneratedQuery: arrTargets[0]?.strQuery ?? strQuery,
        dtQaDeployDate: strQaDeployDate || undefined,
        dtLiveDeployDate: strLiveDeployDate || undefined,
        // 하위 호환: QA 또는 LIVE 날짜 중 대표값
        dtDeployDate: strQaDeployDate || strLiveDeployDate,
        arrDeployScope,
        strCreatedBy: user?.strDisplayName || '',
      };
      if (arrTargets.length > 0) {
        (objPayload as any).arrExecutionTargets = arrTargets;
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
    setNSelectedServiceId(null);
    setNSelectedEventId(null);
    setStrEventName('');
    setStrInputValues('');
    setArrSetSlotValues([]);
    setStrDeployDate('');
    setStrQaDeployDate('');
    setStrLiveDeployDate('');
    setStrAlloLink('');
    setStrGeneratedQuery('');
    setArrExecutionTargets([]);
    setArrDeployScope(['qa', 'live']);
  };

  // 입력 형식에 맞는 placeholder
  const fnGetInputPlaceholder = (strFmt?: TInputFormat): string => {
    const strUse = strFmt || objSelectedEvent?.strInputFormat;
    if (!strUse) return '';
    switch (strUse) {
      case 'item_number':
        return '줄바꿈·쉼표 입력. \'{{items}}\'·({{items}})→7902, 9471 / VALUES {{items}}→(7902), (9471)\n예:\n7902\n9471';
      case 'item_string':
        return '줄바꿈·쉼표 입력. \'{{items}}\'→a,b / ({{items}})→\'a\', \'b\' / VALUES→(\'a\'), (\'b\')';
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

  // 프로덕트 없으면 진입 차단 (템플릿은 리뷰 대기 포함 전체 노출)
  if (arrProducts.length === 0) {
    return (
      <>
        {contextHolder}
        <Title level={4} style={{ marginBottom: 24 }}>
          <CodeOutlined /> 이벤트 생성
        </Title>
        <Card>
          <Result
            status="info"
            title="등록된 프로덕트가 없습니다"
            subTitle={
              arrUserRoles.includes('admin')
                ? '먼저 프로덕트와 쿼리 템플릿을 등록해주세요.'
                : '관리자에게 프로덕트 등록을 요청해주세요.'
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
            { title: STR_SERVICE_SCOPE_LABEL },
            { title: '쿼리 템플릿' },
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

          {/* STEP 2: 서비스 구분 선택 */}
          {objSelectedProduct && (
            <Card title={`2. ${STR_SERVICE_SCOPE_LABEL} 선택`} size="small" style={{ marginTop: 12 }}>
              <Select
                style={{ width: '100%' }}
                placeholder={`${STR_SERVICE_SCOPE_LABEL} 약자를 선택하세요 (예: DK/KR, DK/G)`}
                onChange={fnHandleServiceChange}
                value={nSelectedServiceId}
                size="large"
              >
                {objSelectedProduct.arrServices.map((s) => {
                  const bHasConn =
                    arrDbConnections.length === 0 ||
                    !nSelectedProductId ||
                    fnServiceHasAnyDeployConnection(
                      arrDbConnections,
                      nSelectedProductId,
                      s.strAbbr,
                      s.nServiceId,
                    );

                  return (
                    <Select.Option
                      key={s.nServiceId ?? s.strAbbr}
                      value={s.nServiceId}
                      disabled={!bHasConn || s.nServiceId == null}
                    >
                      <DqpmTag tone="service" style={{ marginRight: 8 }}>
                        {fnFormatCountryPlatformAbbr(s.strAbbr)}
                      </DqpmTag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {fnFormatCountryPlatformRegion(s.strRegion)}
                      </Text>
                      {!bHasConn && arrDbConnections.length > 0 ? (
                        <Text type="danger" style={{ marginLeft: 8, fontSize: 11 }}>
                          (QA/LIVE DB 접속 없음)
                        </Text>
                      ) : null}
                    </Select.Option>
                  );
                })}
              </Select>
              {arrDbConnections.length > 0 && nSelectedServiceId != null && !fnServiceHasAnyDeployConnection(
                arrDbConnections,
                nSelectedProductId!,
                strSelectedAbbr ?? '',
                nSelectedServiceId,
              ) ? (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginTop: 8 }}
                  message={`${fnFormatCountryPlatformMessage(strSelectedAbbr ?? '')} QA/LIVE DB 접속 정보가 없습니다.`}
                  description={`DB 접속 정보에서 프로덕트·${STR_SERVICE_SCOPE_LABEL}(FH/KR, LH/KR, DK/KR, DK/G 등)·환경(QA/LIVE)·종류(GAME/WEB)별로 등록해주세요.`}
                />
              ) : null}
            </Card>
          )}

          {/* STEP 3: 쿼리 템플릿 선택 */}
          {strSelectedAbbr && (
            <Card title="3. 쿼리 템플릿 선택" size="small" style={{ marginTop: 12 }}>
              <Select
                style={{ width: '100%' }}
                placeholder={
                  arrProductTemplates.length > 0
                    ? '쿼리 템플릿을 선택하세요'
                    : '이 프로덕트에 등록된 쿼리 템플릿이 없습니다'
                }
                onChange={fnHandleEventChange}
                value={nSelectedEventId}
                size="large"
                disabled={arrProductTemplates.length === 0}
                optionLabelProp="label"
              >
                {arrProductTemplates.map((e) => {
                  const bStub = fnIsEventTemplateFkStub(e);
                  const bReady = fnResolveTemplateStatus(e) === 'dba_confirmed' && !bStub;
                  return (
                  <Select.Option
                    key={e.nId}
                    value={e.nId}
                    label={`#${e.nId} ${e.strEventLabel}`}
                  >
                    <Space wrap size={4}>
                      <DqpmTag color="default" style={{ fontSize: 11, margin: 0 }}>#{e.nId}</DqpmTag>
                      <span>{e.strEventLabel}</span>
                      <DqpmTag color="blue" style={{ fontSize: 11, margin: 0 }}>{e.strCategory}</DqpmTag>
                      <DqpmTag color="red" style={{ fontSize: 11, margin: 0 }}>{e.strType}</DqpmTag>
                      {bStub ? (
                        <DqpmTag tone="warning" style={{ fontSize: 11, margin: 0 }}>FK 스텁</DqpmTag>
                      ) : !bReady ? (
                        <DqpmTag tone="muted" style={{ fontSize: 11, margin: 0 }}>리뷰 대기</DqpmTag>
                      ) : null}
                    </Space>
                  </Select.Option>
                  );
                })}
              </Select>
              {arrProductTemplates.length > 0 && nReadyTemplateCount === 0 && !objSelectedEvent && (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginTop: 8 }}
                  message="DBA 리뷰 완료된 템플릿이 없습니다"
                  description="리뷰 대기 템플릿은 선택·상태 확인만 가능하며, 승인 후 이벤트 생성이 가능합니다."
                />
              )}
              {objSelectedEvent && (() => {
                const objShape = fnSummarizeTemplateShape(objSelectedEvent);
                const strStatus = fnResolveTemplateStatus(objSelectedEvent);
                const objStatusCfg = OBJ_TEMPLATE_STATUS_CONFIG[strStatus];
                return (
                  <Space wrap style={{ marginTop: 8 }}>
                    <DqpmTag tone={objStatusCfg.strTagVariant} style={{ fontSize: 11, margin: 0 }}>
                      {objStatusCfg.strLabel}
                    </DqpmTag>
                    {objShape.bLegacySingle ? (
                      <DqpmTag>레거시 단일 쿼리</DqpmTag>
                    ) : objShape.bMultiSet ? (
                      <DqpmTag color="blue">다중 세트 ({objShape.nSetCount})</DqpmTag>
                    ) : (
                      <DqpmTag>단일 세트</DqpmTag>
                    )}
                    {objShape.nMaxActiveSlotsPerSet === 0 ? (
                      <DqpmTag tone="muted">입력 없음</DqpmTag>
                    ) : objShape.bMultiSlot ? (
                      <DqpmTag tone="tone4">다중 입력 (슬롯 {objShape.nMaxActiveSlotsPerSet})</DqpmTag>
                    ) : (
                      <DqpmTag tone="muted">단일 입력</DqpmTag>
                    )}
                  </Space>
                );
              })()}
              {objSelectedEvent && (() => {
                if (fnIsEventTemplateFkStub(objSelectedEvent)) {
                  return (
                    <Alert
                      type="warning"
                      showIcon
                      style={{ marginTop: 8 }}
                      message="삭제된 템플릿 참조 (FK 스텁)"
                      description="과거 이벤트 인스턴스가 참조하는 템플릿 ID만 DB에 남아 있는 자동 생성 레코드입니다. 쿼리 내용이 없어 새 이벤트 생성에 사용할 수 없습니다. 쿼리 템플릿 메뉴에서 정상 템플릿을 선택하세요."
                    />
                  );
                }
                const objReviewAlert = fnBuildTemplateReviewAlert(objSelectedEvent);
                if (objReviewAlert) {
                  return (
                    <Alert
                      type={objReviewAlert.strType}
                      message={objReviewAlert.strMessage}
                      description={objReviewAlert.strDescription}
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  );
                }
                if (objSelectedEvent.strDescription?.trim()) {
                  return (
                    <Alert
                      message={objSelectedEvent.strDescription}
                      type="info"
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  );
                }
                return null;
              })()}
            </Card>
          )}

          {/* STEP 4: 값 입력 — DBA 승인 완료 템플릿만 */}
          {objSelectedEvent && bTemplateReady && (
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

                {/* 업무 링크 (선택) */}
                <Form.Item label={<Space>업무 링크 <Text type="secondary" style={{ fontSize: 11 }}>선택사항</Text></Space>}>
                  <Input
                    value={strAlloLink}
                    onChange={(e) => setStrAlloLink(e.target.value)}
                    placeholder="알로·코웤 등 업무 링크 URL (https://...)"
                    size="large"
                    allowClear
                  />
                </Form.Item>

                {/* 반영 범위: QA/LIVE 선택 시 해당 프로덕트에 그 env DB 접속이 있어야 함 */}
                <Form.Item
                  label={
                    <Space>
                      반영 범위
                      <DqpmTag color="red" style={{ fontSize: 11 }}>필수</DqpmTag>
                    </Space>
                  }
                  extra={
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      QA/LIVE 선택 시 {STR_SERVICE_SCOPE_LABEL}(FH/KR, LH/KR, DK/KR, DK/G 등)·템플릿 종류(GAME/WEB)별 DB 접속이 등록·활성화되어 있어야 합니다.
                      {arrDbConnections.length === 0 && ' DB 접속 목록 미로드 시 둘 다 선택 가능하며, 실행 단계에서 검사됩니다.'}
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
                          <DqpmTag tone={opt.strTagVariant}>{opt.label}</DqpmTag>
                          {(opt.value === 'qa' && !bHasQaConnection) || (opt.value === 'live' && !bHasLiveConnection) ? (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {' '}
                              (서비스·종류별 {opt.value.toUpperCase()} DB 접속 없음)
                            </Text>
                          ) : null}
                        </Checkbox>
                      ))}
                    </Space>
                  </Checkbox.Group>
                </Form.Item>

                {arrDbConnections.length > 0 && strSelectedAbbr && arrConnectionPreview.length > 0 ? (
                  <Form.Item
                    label="DB 접속 미리보기"
                    extra={
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        템플릿 세트·{STR_SERVICE_SCOPE_LABEL}·반영 범위 기준으로 QA/LIVE 실행 시 연결될 host/DB입니다.
                      </Text>
                    }
                  >
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: token.borderRadius,
                        border: `1px solid ${token.colorBorderSecondary}`,
                        background: token.colorFillAlter,
                      }}
                    >
                      {[...new Set(arrConnectionPreview.map((r) => r.nSetIndex))].map((nSetIdx, nMapIdx, arrSetKeys) => {
                        const arrSetRows = arrConnectionPreview.filter((r) => r.nSetIndex === nSetIdx);
                        const strKind = arrSetRows[0]?.strKind ?? 'GAME';
                        return (
                          <div key={nSetIdx} style={{ marginBottom: nMapIdx < arrSetKeys.length - 1 ? 10 : 0 }}>
                            {arrSets.length > 1 ? (
                              <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                                세트 {nSetIdx + 1} · {strKind}
                              </Text>
                            ) : null}
                            {arrSetRows.map((row) => (
                              <div
                                key={`${nSetIdx}-${row.strEnv}`}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
                              >
                                <DqpmTag tone={row.strEnv === 'qa' ? 'tone3' : 'danger'} style={{ fontSize: 11, margin: 0 }}>
                                  {row.strEnv.toUpperCase()}
                                </DqpmTag>
                                {row.objConn ? (
                                  <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>
                                    {fnFormatConnectionEndpoint(row.objConn)}
                                  </Text>
                                ) : (
                                  <Text type="danger" style={{ fontSize: 12 }}>접속 없음</Text>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </Form.Item>
                ) : null}

                {/* QA 반영 날짜 — QA 범위 선택 시 표시 */}
                {arrDeployScope.includes('qa') && (
                  <Form.Item
                    label={
                      <Space>
                        QA 반영 날짜
                        <DqpmTag color="red" style={{ fontSize: 11 }}>필수</DqpmTag>
                        <Text type="secondary" style={{ fontSize: 11 }}>이 시각 이후에 QA 실행 가능</Text>
                      </Space>
                    }
                  >
                    <DatePicker
                      style={{ width: '100%' }}
                      showTime={{ format: 'HH:mm:ss' }}
                      format="YYYY-MM-DD HH:mm:ss"
                      placeholder="QA 반영 날짜/시각을 선택하세요"
                      value={strQaDeployDate ? dayjs(strQaDeployDate) : null}
                      onChange={(date) => setStrQaDeployDate(date ? date.toISOString() : '')}
                      size="large"
                    />
                  </Form.Item>
                )}

                {/* LIVE 반영 날짜 — LIVE 범위 선택 시 표시 */}
                {arrDeployScope.includes('live') && (
                  <Form.Item
                    label={
                      <Space>
                        LIVE 반영 날짜
                        <DqpmTag color="red" style={{ fontSize: 11 }}>필수</DqpmTag>
                        <Text type="secondary" style={{ fontSize: 11 }}>이 시각 이후에 LIVE 실행 가능</Text>
                      </Space>
                    }
                  >
                    <DatePicker
                      style={{ width: '100%' }}
                      showTime={{ format: 'HH:mm:ss' }}
                      format="YYYY-MM-DD HH:mm:ss"
                      placeholder="LIVE 반영 날짜/시각을 선택하세요"
                      value={strLiveDeployDate ? dayjs(strLiveDeployDate) : null}
                      onChange={(date) => setStrLiveDeployDate(date ? date.toISOString() : '')}
                      size="large"
                    />
                  </Form.Item>
                )}

                {/* 세트·슬롯별 입력값 */}
                {(() => {
                  const arrSetsForInput = arrSets.map((s) =>
                    fnNormalizeQueryTemplateItem(s, objSelectedEvent.strInputFormat),
                  );
                  if (arrSetsForInput.length === 0) {
                    if ((objSelectedEvent.strInputFormat ?? 'item_number') === 'none') return null;
                    return (
                      <Form.Item
                        label={
                          <Space>
                            <Text strong>입력값</Text>
                            <DqpmTag color="red" style={{ fontSize: 11 }}>필수</DqpmTag>
                          </Space>
                        }
                      >
                        <TextArea
                          value={strInputValues}
                          onChange={(e) => setStrInputValues(e.target.value)}
                          rows={4}
                          placeholder={fnGetInputPlaceholder(objSelectedEvent.strInputFormat)}
                          className={STR_CODE_BLOCK_CLASS}
                          style={objSqlInputStyle}
                        />
                      </Form.Item>
                    );
                  }

                  const fnRenderSetSlots = (
                    objNorm: ReturnType<typeof fnNormalizeQueryTemplateItem>,
                    nSetIdx: number,
                  ) => (
                    <QuerySetInputSlotRows
                      arrSlots={(objNorm.arrInputs ?? []).filter((s) => s.strInputFormat !== 'none')}
                      strThirdColumnLabel="입력값"
                      objSqlFieldStyle={objSqlFormInputStyle}
                      fnRenderValueCell={(objSlot) => (
                        <Input
                          value={arrSetSlotValues[nSetIdx]?.[objSlot.strInputId] ?? ''}
                          onChange={(e) => {
                            setArrSetSlotValues((prev) => {
                              const next = prev.map((m) => ({ ...m }));
                              while (next.length <= nSetIdx) next.push({});
                              next[nSetIdx] = {
                                ...next[nSetIdx],
                                [objSlot.strInputId]: e.target.value,
                              };
                              return next;
                            });
                          }}
                          placeholder={
                            objSlot.strInputFormat === 'date' ? '예: 20251125' : '예: 1,2,3'
                          }
                          className={STR_CODE_BLOCK_CLASS}
                          style={objSqlFormInputStyle}
                        />
                      )}
                    />
                  );

                  const fnCountActiveSlots = (objNorm: ReturnType<typeof fnNormalizeQueryTemplateItem>): number =>
                    (objNorm.arrInputs ?? []).filter((s) => s.strInputFormat !== 'none').length;

                  const bAnySlot = arrSetsForInput.some((s) =>
                    (s.arrInputs ?? []).some((slot) => slot.strInputFormat !== 'none'),
                  );
                  if (!bAnySlot) return null;

                  if (arrSetsForInput.length >= 2) {
                    return (
                      <Form.Item
                        label={
                          <Space>
                            <Text strong>쿼리 세트별 입력값</Text>
                            <DqpmTag color="red" style={{ fontSize: 11 }}>필수</DqpmTag>
                          </Space>
                        }
                        extra={
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            세트마다 입력 ID·형식·입력값을 입력합니다 (ID/형식은 템플릿 기준 읽기 전용).
                          </Text>
                        }
                      >
                        <Tabs
                          type="card"
                          size="small"
                          items={arrSetsForInput.map((objNorm, idx) => {
                            const nSlots = fnCountActiveSlots(objNorm);
                            return {
                              key: String(idx),
                              label: nSlots > 1 ? `세트 ${idx + 1} · ${nSlots}슬롯` : `세트 ${idx + 1}`,
                              children: (
                                <div style={{ paddingTop: 4 }}>
                                  {fnRenderSetSlots(objNorm, idx)}
                                </div>
                              ),
                            };
                          })}
                        />
                      </Form.Item>
                    );
                  }

                  return (
                    <Form.Item
                      label={
                        <Space>
                          <Text strong>입력값</Text>
                          <DqpmTag color="red" style={{ fontSize: 11 }}>필수</DqpmTag>
                        </Space>
                      }
                      extra={
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          입력 ID·형식·입력값 (3열). VALUES (a,b) 목록 zip 은 지원하지 않습니다.
                        </Text>
                      }
                    >
                      {fnRenderSetSlots(arrSetsForInput[0], 0)}
                    </Form.Item>
                  );
                })()}
              </Form>

              {bCanCreate ? (
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  onClick={fnGenerateQuery}
                  loading={bSubmitting}
                  disabled={!bTemplateReady}
                  block
                  size="large"
                  style={{
                    background: strSubmitGradient,
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
                {arrExecutionTargets.length > 0 ? (
                  <Tabs
                    type="card"
                    items={arrExecutionTargets.map((t, idx) => ({
                      key: String(idx),
                      label: `쿼리 세트 ${idx + 1}${fnFormatExecutionTargetConnLabel(t)}`,
                      children: (
                        <TextArea
                          className={`${STR_CODE_BLOCK_CLASS} dqpm-code-block`}
                          value={t.strQuery}
                          readOnly
                          autoSize={{ minRows: 8, maxRows: 20 }}
                          style={{
                            ...objSqlReadonlyStyle,
                            padding: 12,
                            marginTop: 8,
                          }}
                        />
                      ),
                    }))}
                  />
                ) : (
                  <TextArea
                    className="dqpm-font-mono dqpm-code-block"
                    value={strGeneratedQuery}
                    readOnly
                    autoSize={{ minRows: 10, maxRows: 25 }}
                    style={{
                      ...objSqlReadonlyStyle,
                      padding: 16,
                    }}
                  />
                )}
              </>
            ) : (
              <div style={{ padding: '80px 0', textAlign: 'center', color: token.colorTextQuaternary }}>
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
