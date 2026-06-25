// 이벤트 인스턴스 (운영자가 생성한 실제 이벤트)

/** Phase 3 이전 인스턴스 활성 상태 — 기동 시 event_created 로 승격 */
export type TLegacyInstanceStatus = 'confirm_requested' | 'dba_confirmed';

// 이벤트 상태 워크플로 (7단계)
// event_created → qa_requested → qa_deployed → qa_verified
// → live_requested → live_deployed → live_verified(완료)
export type TEventStatus =
  | 'event_created'       // 운영자 이벤트 생성 (수정 가능)
  | 'qa_requested'        // 운영자 QA 반영 요청
  | 'qa_deployed'         // DBA QA 반영
  | 'qa_verified'         // 운영자 QA 확인
  | 'live_requested'      // 운영자 라이브 반영 요청
  | 'live_deployed'       // DBA LIVE 반영
  | 'live_verified';      // 운영자 LIVE 확인 (최종 완료)

/** 진행 이력 strStatus — 레거시 단계 포함 */
export type TInstanceStatusLogStatus = TEventStatus | TLegacyInstanceStatus;

const ARR_LEGACY_INSTANCE_ACTIVE: TLegacyInstanceStatus[] = ['confirm_requested', 'dba_confirmed'];

/** DBA 쿼리 직접 수정 diff (진행 이력) */
export interface IQueryEditLog {
  strBefore?: string;
  strAfter?: string;
  arrSetChanges?: Array<{
    nSetIndex: number;
    strBefore: string;
    strAfter: string;
  }>;
}

export interface IStatusLog {
  strStatus: TInstanceStatusLogStatus;
  strChangedBy: string;       // 처리자 표시 이름
  nChangedByUserId: number;   // 처리자 사용자 ID
  strComment: string;
  dtChangedAt: string;
  /** DBA 쿼리 직접 수정 시 이전·이후 텍스트 */
  objQueryEdit?: IQueryEditLog;
  // 쿼리 실행 결과 (성공: qa_deployed/live_deployed 직전 로그, 실패: qa_requested/live_requested 유지 시 실패 이력)
  objExecutionResult?: {
    strEnv: 'qa' | 'live';
    /** false면 실행 실패 이력(상태는 전이되지 않음) */
    bSuccess?: boolean;
    nTotalAffectedRows: number;
    nElapsedMs: number;
    strError?: string;
    /** 사용 접속 요약(비밀번호 제외) — 다중 세트면 세트 순서대로 구분 */
    strConnectionSummary?: string;
    arrQueryResults: Array<{
      nIndex: number;
      strQuery: string;
      nAffectedRows: number;
      nSetIndex?: number;
      nSetTotal?: number;
    }>;
  };
}

// 각 단계별 처리자 정보
export interface IStageActor {
  strDisplayName: string;     // 표시 이름
  nUserId: number;            // 사용자 ID
  strUserId: string;          // 로그인 아이디
  dtProcessedAt: string;      // 처리 시각
}

// 실행 대상 1건: QA/LIVE 접속 ID + 생성된 쿼리 (템플릿에 arrQueryTemplates 있을 때)
export interface IExecutionTarget {
  nQaDbConnectionId: number;
  nLiveDbConnectionId: number;
  /** @deprecated nQaDbConnectionId 로 이관 */
  nDbConnectionId?: number;
  strQuery: string;
}

export interface IEventInstance {
  nId: number;
  // 템플릿 정보
  nEventTemplateId: number;
  nProductId: number;               // DB 접속 정보 조회용 (추가)
  /** 생성 시 product_service FK — 대시보드 표시는 strServiceAbbr 스냅샷 */
  nServiceId?: number;
  strEventLabel: string;
  strProductName: string;
  strServiceAbbr: string;
  strServiceRegion: string;
  strCategory: string;
  strType: string;
  // 생성자 입력 정보
  strEventName: string;
  strInputValues: string;
  /** 단일 쿼리 (레거시 또는 템플릿에 arrQueryTemplates 없을 때) */
  strGeneratedQuery: string;
  /** 실행 대상 목록 (템플릿에 arrQueryTemplates 있을 때: DB 연결별 생성 쿼리) */
  arrExecutionTargets?: IExecutionTarget[];
  /** @deprecated dtQaDeployDate / dtLiveDeployDate 분리 후 호환용으로 유지 */
  dtDeployDate: string;
  dtQaDeployDate?: string;                // QA 반영 날짜 (이 시각 이전에 QA 실행 허용)
  dtLiveDeployDate?: string;              // LIVE 반영 날짜 (이 시각 이후에 LIVE 실행 허용)
  strAlloLink?: string;                   // 업무 링크 URL (알로·코웤 등, 선택)
  arrDeployScope: Array<'qa' | 'live'>;   // 쿼리 실행 대상: 단일 서버(QA만 또는 LIVE만) 또는 다중 서버(QA+LIVE)
  // 상태
  strStatus: TEventStatus;
  arrStatusLogs: IStatusLog[];
  // 단계별 처리자 (명확한 추적)
  objCreator: IStageActor | null;         // 생성자
  /** @deprecated Phase 3 — DBA 컨펌은 템플릿 objConfirmer 로 이전 */
  objConfirmer: IStageActor | null;
  objQaRequester: IStageActor | null;     // QA 반영 요청자
  objQaDeployer: IStageActor | null;      // QA 반영자
  objQaVerifier: IStageActor | null;      // QA 확인자
  objLiveRequester: IStageActor | null;   // 라이브 반영 요청자
  objLiveDeployer: IStageActor | null;    // LIVE 반영자
  objLiveVerifier: IStageActor | null;    // LIVE 확인자
  // 메타
  strCreatedBy: string;
  nCreatedByUserId: number;
  dtCreatedAt: string;
  /** 삭제(복원 불가) — 완료·숨김 탭에만 표시, 서버에서 수정·실행·상태변경 차단 */
  bPermanentlyRemoved?: boolean;
  dtPermanentlyRemovedAt?: string;
}

import { fnLoadJson, fnSaveJson, fnReadJsonArrayFromDisk, fnMirrorJsonToDisk } from './jsonStore';
import { fnIsMysqlStore } from './dataStore';

const STR_FILE = 'eventInstances.json';

/** 진행 중 인스턴스의 레거시 confirm/dba_confirmed → event_created (D7) */
export const fnNormalizeEventInstance = (raw: IEventInstance): IEventInstance => {
  const strRawStatus = raw.strStatus as TEventStatus | TLegacyInstanceStatus;
  if (!ARR_LEGACY_INSTANCE_ACTIVE.includes(strRawStatus as TLegacyInstanceStatus)) {
    return raw;
  }
  const arrStatusLogs = Array.isArray(raw.arrStatusLogs) ? [...raw.arrStatusLogs] : [];
  arrStatusLogs.push({
    strStatus: 'event_created',
    strChangedBy: 'system',
    nChangedByUserId: 0,
    strComment: '워크플로 분리 마이그레이션: confirm/dba_confirmed → event_created',
    dtChangedAt: new Date().toISOString(),
  });
  return { ...raw, strStatus: 'event_created', arrStatusLogs };
};

const rawInstances = fnLoadJson<IEventInstance>(STR_FILE, []);
const migratedInstances = rawInstances.map((e) => fnNormalizeEventInstance(e));
const bNeedInstanceSave = migratedInstances.some(
  (e, i) => e.strStatus !== rawInstances[i]?.strStatus || e.arrStatusLogs.length !== (rawInstances[i]?.arrStatusLogs?.length ?? 0),
);
if (bNeedInstanceSave) fnSaveJson(STR_FILE, migratedInstances);

export const arrEventInstances: IEventInstance[] = migratedInstances;

/** 메모리가 비어 있고 디스크에 건수가 있으면 eventInstances.json에서 다시 채움 */
export const fnReloadEventInstancesFromDiskIfEmpty = (): boolean => {
  if (arrEventInstances.length > 0) return false;
  if (fnIsMysqlStore()) return false;
  const arrRaw = fnReadJsonArrayFromDisk<IEventInstance>(STR_FILE);
  if (!arrRaw?.length) return false;
  const arrMigrated = arrRaw.map((e) => fnNormalizeEventInstance(e));
  arrEventInstances.length = 0;
  arrEventInstances.push(...arrMigrated);
  console.log(`[eventInstances] 메모리 비어 ${STR_FILE}에서 ${arrMigrated.length}건 재로드`);
  return true;
};

export const fnSaveEventInstances = () => {
  if (fnIsMysqlStore()) {
    fnMirrorJsonToDisk(STR_FILE, arrEventInstances);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {
      fnScheduleMysqlEventInstanceReplace,
      fnCancelMysqlDocFlushForFiles,
    } = require('../db/mysqlDocPersist') as typeof import('../db/mysqlDocPersist');
    fnCancelMysqlDocFlushForFiles(['eventInstances.json']);
    fnScheduleMysqlEventInstanceReplace();
    return;
  }
  fnSaveJson(STR_FILE, arrEventInstances);
};

/** 메모리 저장 후 MySQL doc flush까지 대기 (재시작 전 유실 방지) */
export const fnCommitEventInstancesToStore = async (): Promise<void> => {
  fnSaveEventInstances();
  if (fnIsMysqlStore()) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { fnAwaitMysqlEventInstanceFlush } = require('../db/mysqlDocPersist') as typeof import('../db/mysqlDocPersist');
    await fnAwaitMysqlEventInstanceFlush();
  }
};

export const fnGetNextInstanceId = (): number =>
  arrEventInstances.length > 0 ? Math.max(...arrEventInstances.map((e) => e.nId)) + 1 : 1;
