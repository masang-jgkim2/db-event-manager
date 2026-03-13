// 이벤트 인스턴스 (운영자가 생성한 실제 이벤트)

// 이벤트 상태 워크플로 (9단계)
// event_created → confirm_requested → dba_confirmed
// → qa_requested → qa_deployed → qa_verified
// → live_requested → live_deployed → live_verified(완료)
export type TEventStatus =
  | 'event_created'       // 운영자 이벤트 생성 (수정 가능)
  | 'confirm_requested'   // 운영자 컨펌 요청 (수정 불가)
  | 'dba_confirmed'       // DBA 컨펌 확인
  | 'qa_requested'        // 운영자 QA 반영 요청
  | 'qa_deployed'         // DBA QA 반영
  | 'qa_verified'         // 운영자 QA 확인
  | 'live_requested'      // 운영자 라이브 반영 요청
  | 'live_deployed'       // DBA LIVE 반영
  | 'live_verified';      // 운영자 LIVE 확인 (최종 완료)

export interface IStatusLog {
  strStatus: TEventStatus;
  strChangedBy: string;       // 처리자 표시 이름
  nChangedByUserId: number;   // 처리자 사용자 ID
  strComment: string;
  dtChangedAt: string;
  // 쿼리 실행 결과 (qa_deployed, live_deployed 단계에서만 포함)
  objExecutionResult?: {
    strEnv: 'qa' | 'live';
    nTotalAffectedRows: number;
    nElapsedMs: number;
    arrQueryResults: Array<{ nIndex: number; strQuery: string; nAffectedRows: number }>;
  };
}

// 각 단계별 처리자 정보
export interface IStageActor {
  strDisplayName: string;     // 표시 이름
  nUserId: number;            // 사용자 ID
  strUserId: string;          // 로그인 아이디
  dtProcessedAt: string;      // 처리 시각
}

// 실행 대상 1건: DB 접속 ID + 생성된 쿼리 (템플릿에 arrQueryTemplates 있을 때)
export interface IExecutionTarget {
  nDbConnectionId: number;
  strQuery: string;
}

export interface IEventInstance {
  nId: number;
  // 템플릿 정보
  nEventTemplateId: number;
  nProductId: number;               // DB 접속 정보 조회용 (추가)
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
  dtDeployDate: string;                   // 반영 날짜 (datetime, ISO 8601)
  arrDeployScope: Array<'qa' | 'live'>;   // 쿼리 실행 대상: 단일 서버(QA만 또는 LIVE만) 또는 다중 서버(QA+LIVE)
  // 상태
  strStatus: TEventStatus;
  arrStatusLogs: IStatusLog[];
  // 단계별 처리자 (명확한 추적)
  objCreator: IStageActor | null;         // 생성자
  objConfirmer: IStageActor | null;       // DBA 컨펌자
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
}

import { fnLoadJson, fnSaveJson } from './jsonStore';

const STR_FILE = 'eventInstances.json';

export const arrEventInstances: IEventInstance[] = fnLoadJson<IEventInstance>(STR_FILE, []);

export const fnSaveEventInstances = () => fnSaveJson(STR_FILE, arrEventInstances);

export const fnGetNextInstanceId = (): number =>
  arrEventInstances.length > 0 ? Math.max(...arrEventInstances.map((e) => e.nId)) + 1 : 1;
