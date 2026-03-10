// =============================================
// 권한 코드 (세부 기능 접근 제어)
// =============================================
export type TPermission =
  | 'product.manage'           // 프로덕트 CRUD
  | 'event_template.manage'    // 이벤트 템플릿 CRUD
  | 'user.manage'              // 사용자 관리
  | 'db.manage'                // DB 접속 정보 관리
  | 'instance.create'          // 이벤트 인스턴스 생성
  | 'instance.approve_qa'      // QA 승인 (dba_confirmed → qa_requested)
  | 'instance.execute_qa'      // QA DB 실제 실행 (qa_requested → qa_deployed)
  | 'instance.verify_qa'       // QA 확인 (qa_deployed → qa_verified)
  | 'instance.approve_live'    // LIVE 승인 (qa_verified → live_requested)
  | 'instance.execute_live'    // LIVE DB 실제 실행 (live_requested → live_deployed)
  | 'instance.verify_live';    // LIVE 확인 (live_deployed → live_verified)

// =============================================
// 역할 모델 (동적 관리)
// =============================================
export interface IRole {
  nId: number;
  strCode: string;                // 역할 코드 (unique, 예: 'admin', 'dba', 'game_manager')
  strDisplayName: string;         // 표시 이름 (예: '관리자', 'DBA', 'GM')
  strDescription: string;         // 역할 설명
  arrPermissions: TPermission[];  // 이 역할이 가지는 권한 목록
  bIsSystem: boolean;             // true: 시스템 기본 역할 (삭제 불가, 권한만 수정)
  dtCreatedAt: string;
  dtUpdatedAt: string;
}

// =============================================
// 사용자 인터페이스
// =============================================
export interface IUser {
  nId: number;
  strUserId: string;              // 로그인 아이디 (unique, 변경 불가)
  strPassword: string;
  strDisplayName: string;         // 표시 이름 (수정 가능)
  arrRoles: string[];             // 역할 코드 배열 (멀티 역할 지원, 예: ['admin', 'dba'])
  dtCreatedAt: Date;
}

// JWT 페이로드 (토큰에 포함)
export interface IJwtPayload {
  nId: number;
  strUserId: string;
  arrRoles: string[];              // 역할 코드 배열
  arrPermissions: TPermission[];   // 전체 역할의 권한 합집합
}

// 로그인 요청
export interface ILoginRequest {
  strUserId: string;
  strPassword: string;
}

// 로그인 응답
export interface ILoginResponse {
  bSuccess: boolean;
  strToken?: string;
  user?: {
    nId: number;
    strUserId: string;
    strDisplayName: string;
    arrRoles: string[];
    arrPermissions: TPermission[];
  };
  strMessage?: string;
}

// =============================================
// DB 접속 정보
// =============================================
export interface IDbConnection {
  nId: number;
  nProductId: number;
  strProductName: string;           // 자동 매핑
  strEnv: 'dev' | 'qa' | 'live';   // 환경 구분
  strDbType: 'mssql' | 'mysql';    // DB 드라이버 종류
  strHost: string;
  nPort: number;                    // MSSQL 기본 1433, MySQL 기본 3306
  strDatabase: string;
  strUser: string;
  strPassword: string;              // 인메모리 평문 저장 (Phase 2 암호화 예정)
  bIsActive: boolean;               // 비활성화 시 실행 차단
  dtCreatedAt: string;
  dtUpdatedAt: string;
}

// =============================================
// 쿼리 실행 결과
// =============================================

// 개별 쿼리 결과
export interface IQueryPartResult {
  nIndex: number;       // 몇 번째 쿼리 (0부터)
  strQuery: string;     // 실행된 개별 쿼리
  nAffectedRows: number;
}

// 전체 실행 결과
export interface IQueryExecutionResult {
  bSuccess: boolean;
  strEnv: 'qa' | 'live';
  strExecutedQuery: string;              // 실행한 전체 원본 쿼리
  arrQueryResults: IQueryPartResult[];   // 개별 쿼리별 결과
  nTotalAffectedRows: number;           // 전체 영향 행 합계
  nElapsedMs: number;                   // 실행 소요 시간(ms)
  strError?: string;                    // 실패 시 오류 메시지
  strRollbackMsg?: string;              // 롤백 완료 메시지
  dtExecutedAt: string;
}
