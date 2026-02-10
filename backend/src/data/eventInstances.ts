// 이벤트 인스턴스 (운영자가 생성한 실제 이벤트)

// 이벤트 상태 워크플로
// template_created → event_created → dba_confirmed → qa_deployed → qa_verified → live_deployed → live_verified
export type TEventStatus =
  | 'event_created'    // 운영자가 이벤트 생성
  | 'dba_confirmed'    // DBA 컨펌 확인
  | 'qa_deployed'      // DBA QA 반영 완료
  | 'qa_verified'      // 운영자 QA 반영 확인
  | 'live_deployed'    // DBA LIVE 반영 완료
  | 'live_verified';   // 운영자 LIVE 반영 확인 (최종 완료)

export interface IStatusLog {
  strStatus: TEventStatus;
  strChangedBy: string;     // 상태 변경한 사용자 이름
  strComment: string;       // 코멘트 (선택)
  dtChangedAt: string;
}

export interface IEventInstance {
  nId: number;
  // 템플릿 정보
  nEventTemplateId: number;
  strEventLabel: string;       // 이벤트 템플릿명
  strProductName: string;
  strServiceAbbr: string;      // 선택된 서비스 약자
  strServiceRegion: string;    // 서비스 범위
  strCategory: string;         // 이벤트 종류 (아이템/퀘스트)
  strType: string;             // 이벤트 유형 (삭제/지급/초기화)
  // 생성자 입력 정보
  strEventName: string;        // 자동 생성된 이벤트 이름
  strInputValues: string;      // 입력한 아이템/퀘스트 값
  strGeneratedQuery: string;   // 생성된 쿼리
  dtExecDate: string;          // 이벤트 실행 날짜 (필수)
  // 상태
  strStatus: TEventStatus;
  arrStatusLogs: IStatusLog[]; // 상태 변경 이력
  // 메타
  strCreatedBy: string;        // 생성자 (담당자)
  nCreatedByUserId: number;    // 생성자 ID
  dtCreatedAt: string;
}

export const arrEventInstances: IEventInstance[] = [];

export const fnGetNextInstanceId = (): number => {
  return arrEventInstances.length > 0
    ? Math.max(...arrEventInstances.map((e) => e.nId)) + 1
    : 1;
};
