-- =============================================================
-- Database Query Process Manager (DQPM) - 데이터베이스 스키마
-- 대상 DB: MySQL 8.0+ / MSSQL 2019+ (표준 SQL 기준)
-- 현재 인메모리 구조를 DB로 전환 시 사용
-- =============================================================

-- 역할 테이블
CREATE TABLE roles (
  n_id            INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  str_code        VARCHAR(50)   NOT NULL UNIQUE COMMENT '역할 코드 (admin, dba, game_manager ...)',
  str_display_name VARCHAR(100) NOT NULL COMMENT '표시 이름',
  str_description TEXT          NULL,
  arr_permissions JSON          NOT NULL DEFAULT '[]' COMMENT 'TPermission[] 배열',
  b_is_system     TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '시스템 역할 여부 (삭제 불가)',
  dt_created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dt_updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 사용자 테이블
CREATE TABLE users (
  n_id            INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  str_user_id     VARCHAR(50)   NOT NULL UNIQUE COMMENT '로그인 ID (변경 불가)',
  str_password    VARCHAR(255)  NOT NULL COMMENT 'bcrypt 해시',
  str_display_name VARCHAR(100) NOT NULL COMMENT '표시 이름',
  arr_roles       JSON          NOT NULL DEFAULT '[]' COMMENT '역할 코드 배열 (str_code 참조)',
  dt_created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 프로덕트 테이블
CREATE TABLE products (
  n_id            INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  str_name        VARCHAR(100)  NOT NULL UNIQUE,
  str_description TEXT          NULL,
  str_db_type     VARCHAR(20)   NOT NULL COMMENT 'mysql | mssql | postgresql',
  arr_services    JSON          NOT NULL DEFAULT '[]' COMMENT 'IService[] 배열 [{strAbbr, strRegion}]',
  dt_created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 쿼리 템플릿 테이블
CREATE TABLE event_templates (
  n_id              INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  n_product_id      INT           NOT NULL,
  str_product_name  VARCHAR(100)  NOT NULL,
  str_event_label   VARCHAR(200)  NOT NULL COMMENT '쿼리 템플릿 이름',
  str_category      VARCHAR(50)   NOT NULL COMMENT '아이템 | 퀘스트',
  str_type          VARCHAR(50)   NOT NULL COMMENT '삭제 | 지급 | 초기화',
  str_input_format  VARCHAR(50)   NOT NULL COMMENT '입력 형식',
  str_description   TEXT          NULL,
  str_default_items TEXT          NULL,
  str_query_template TEXT         NULL COMMENT '{{items}}, {{date}}, {{event_name}} 치환 변수 (레거시 단일)',
  arr_query_templates JSON        NOT NULL DEFAULT ('[]') COMMENT 'IQueryTemplateItem[] 다중 쿼리 세트',
  dt_created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (n_product_id) REFERENCES products(n_id) ON DELETE RESTRICT
);

-- DB 접속 정보 테이블
CREATE TABLE db_connections (
  n_id              INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  n_product_id      INT           NOT NULL,
  str_product_name  VARCHAR(100)  NOT NULL,
  str_kind          VARCHAR(20)     NOT NULL DEFAULT 'GAME' COMMENT 'GAME | WEB | LOG',
  str_env           VARCHAR(10)   NOT NULL COMMENT 'dev | qa | live',
  str_db_type       VARCHAR(20)   NOT NULL COMMENT 'mssql | mysql',
  str_host          VARCHAR(255)  NOT NULL,
  n_port            INT           NOT NULL,
  str_database      VARCHAR(100)  NOT NULL,
  str_user          VARCHAR(100)  NOT NULL,
  str_password      VARCHAR(255)  NOT NULL COMMENT '암호화 저장 권장 (AES-256)',
  b_is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  dt_created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dt_updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (n_product_id) REFERENCES products(n_id) ON DELETE CASCADE,
  UNIQUE KEY uq_product_env_kind (n_product_id, str_env, str_kind)
);

-- 이벤트 인스턴스 테이블
CREATE TABLE event_instances (
  n_id                    INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  n_event_template_id     INT           NOT NULL,
  n_product_id            INT           NOT NULL COMMENT 'DB 접속 조회용 (fnFindActiveConnection)',
  str_event_label         VARCHAR(200)  NOT NULL,
  str_product_name        VARCHAR(100)  NOT NULL,
  str_service_abbr        VARCHAR(50)   NOT NULL,
  str_service_region      VARCHAR(50)   NOT NULL,
  str_category            VARCHAR(50)   NOT NULL,
  str_type                VARCHAR(50)   NOT NULL,
  str_event_name          VARCHAR(200)  NOT NULL,
  str_input_values        TEXT          NULL,
  str_generated_query     LONGTEXT      NULL,
  arr_execution_targets   JSON          NOT NULL DEFAULT ('[]') COMMENT 'IExecutionTarget[] {nDbConnectionId, strQuery}',
  dt_deploy_date          DATETIME      NOT NULL COMMENT '레거시/호환 (코드: dtDeployDate ISO 8601)',
  dt_qa_deploy_date       DATETIME      NULL COMMENT 'QA 실행 허용 기준일 (코드: dtQaDeployDate)',
  dt_live_deploy_date     DATETIME      NULL COMMENT 'LIVE 실행 허용 기준일 (코드: dtLiveDeployDate)',
  str_allo_link           VARCHAR(500)  NULL COMMENT '알로 업무 카드 링크 (코드: strAlloLink)',
  arr_deploy_scope        JSON          NOT NULL DEFAULT ('["qa", "live"]') COMMENT '반영 범위 qa|live (코드: arrDeployScope)',
  str_status              VARCHAR(30)   NOT NULL DEFAULT 'event_created',

  -- 단계별 처리자 (JSON으로 저장)
  obj_creator             JSON          NULL,
  obj_confirmer           JSON          NULL,
  obj_qa_requester        JSON          NULL,
  obj_qa_deployer         JSON          NULL,
  obj_qa_verifier         JSON          NULL,
  obj_live_requester      JSON          NULL,
  obj_live_deployer       JSON          NULL,
  obj_live_verifier       JSON          NULL,

  -- 이력 (JSON 배열)
  arr_status_logs         JSON          NOT NULL DEFAULT '[]',

  str_created_by          VARCHAR(100)  NOT NULL,
  n_created_by_user_id    INT           NOT NULL,
  dt_created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  b_permanently_removed   TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '복원 불가 삭제 (코드: bPermanentlyRemoved)',
  dt_permanently_removed_at DATETIME      NULL COMMENT '코드: dtPermanentlyRemovedAt',

  FOREIGN KEY (n_event_template_id) REFERENCES event_templates(n_id) ON DELETE RESTRICT,
  FOREIGN KEY (n_product_id) REFERENCES products(n_id) ON DELETE RESTRICT,
  FOREIGN KEY (n_created_by_user_id) REFERENCES users(n_id) ON DELETE RESTRICT,

  INDEX idx_status (str_status),
  INDEX idx_product_id (n_product_id),
  INDEX idx_created_by (n_created_by_user_id),
  INDEX idx_created_at (dt_created_at)
);

-- =============================================================
-- 시드 데이터 (역할)
-- =============================================================
INSERT INTO roles (str_code, str_display_name, str_description, arr_permissions, b_is_system) VALUES
('admin',         '관리자', '전체 시스템 관리 권한',
  '["product.view","product.manage","event_template.view","event_template.manage","user.manage","db.manage","instance.create","instance.approve_qa","instance.execute_qa","instance.verify_qa","instance.approve_live","instance.execute_live","instance.verify_live"]',
  1),
('dba',           'DBA',   'DB 쿼리 실행 전담',
  '["instance.execute_qa","instance.execute_live"]',
  1),
('game_manager',  'GM',    '게임 운영 관리자',
  '["product.view","event_template.view","instance.create","instance.approve_qa","instance.verify_qa","instance.approve_live","instance.verify_live"]',
  1),
('game_designer', '기획자', '이벤트 기획 및 생성',
  '["product.view","event_template.view","instance.create"]',
  1);

-- =============================================================
-- 기본 관리자 계정 (비밀번호: admin123 → bcrypt 해시로 교체 필요)
-- =============================================================
INSERT INTO users (str_user_id, str_password, str_display_name, arr_roles) VALUES
('admin', '$BCRYPT_HASH_HERE', '관리자', '["admin"]');
