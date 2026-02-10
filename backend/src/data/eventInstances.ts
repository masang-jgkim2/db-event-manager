// 이벤트 인스턴스 (운영자가 생성한 실제 이벤트)

// 이벤트 상태 워크플로
// event_created → confirm_requested → dba_confirmed → qa_deployed → qa_verified → live_deployed → live_verified(완료)
export type TEventStatus =
  | 'event_created'       // 운영자 이벤트 생성 (수정 가능)
  | 'confirm_requested'   // 운영자 컨펌 요청 (수정 불가)
  | 'dba_confirmed'       // DBA 컨펌 확인
  | 'qa_deployed'         // DBA QA 반영
  | 'qa_verified'         // 운영자 QA 확인
  | 'live_deployed'       // DBA LIVE 반영
  | 'live_verified';      // 운영자 LIVE 확인 (최종 완료)

export interface IStatusLog {
  strStatus: TEventStatus;
  strChangedBy: string;       // 처리자 표시 이름
  nChangedByUserId: number;   // 처리자 사용자 ID
  strComment: string;
  dtChangedAt: string;
}

// 각 단계별 처리자 정보
export interface IStageActor {
  strDisplayName: string;     // 표시 이름
  nUserId: number;            // 사용자 ID
  strUserId: string;          // 로그인 아이디
  dtProcessedAt: string;      // 처리 시각
}

export interface IEventInstance {
  nId: number;
  // 템플릿 정보
  nEventTemplateId: number;
  strEventLabel: string;
  strProductName: string;
  strServiceAbbr: string;
  strServiceRegion: string;
  strCategory: string;
  strType: string;
  // 생성자 입력 정보
  strEventName: string;
  strInputValues: string;
  strGeneratedQuery: string;
  dtExecDate: string;
  // 상태
  strStatus: TEventStatus;
  arrStatusLogs: IStatusLog[];
  // 단계별 처리자 (명확한 추적)
  objCreator: IStageActor | null;       // 생성자
  objConfirmer: IStageActor | null;     // DBA 컨펌자
  objQaDeployer: IStageActor | null;    // QA 반영자
  objQaVerifier: IStageActor | null;    // QA 확인자
  objLiveDeployer: IStageActor | null;  // LIVE 반영자
  objLiveVerifier: IStageActor | null;  // LIVE 확인자
  // 메타
  strCreatedBy: string;
  nCreatedByUserId: number;
  dtCreatedAt: string;
}

export const arrEventInstances: IEventInstance[] = [];

export const fnGetNextInstanceId = (): number => {
  return arrEventInstances.length > 0
    ? Math.max(...arrEventInstances.map((e) => e.nId)) + 1
    : 1;
};
