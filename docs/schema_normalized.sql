-- =============================================================
-- Database Query Process Manager (DQPM) - 정규화 스키마 (JSON 컬럼 분리)
-- 로그/감사 조회에 유리하도록 JSON을 별도 테이블로 분리
-- =============================================================

-- -----------------------------------------
-- 역할
-- -----------------------------------------
CREATE TABLE roles (
  n_id             INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  str_code         VARCHAR(50)   NOT NULL UNIQUE,
  str_display_name VARCHAR(100)  NOT NULL,
  str_description  TEXT          NULL,
  b_is_system      TINYINT(1)    NOT NULL DEFAULT 0,
  dt_created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dt_updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 역할별 권한 (기존 arr_permissions JSON 분리)
CREATE TABLE role_permissions (
  n_role_id      INT          NOT NULL,
  str_permission VARCHAR(80)  NOT NULL,
  PRIMARY KEY (n_role_id, str_permission),
  FOREIGN KEY (n_role_id) REFERENCES roles(n_id) ON DELETE CASCADE
);

-- -----------------------------------------
-- 사용자
-- -----------------------------------------
CREATE TABLE users (
  n_id             INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  str_user_id      VARCHAR(50)   NOT NULL UNIQUE,
  str_password     VARCHAR(255)  NOT NULL,
  str_display_name VARCHAR(100)  NOT NULL,
  dt_created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 사용자별 역할 (기존 arr_roles JSON 분리)
CREATE TABLE user_roles (
  n_user_id INT NOT NULL,
  n_role_id  INT NOT NULL,
  PRIMARY KEY (n_user_id, n_role_id),
  FOREIGN KEY (n_user_id) REFERENCES users(n_id) ON DELETE CASCADE,
  FOREIGN KEY (n_role_id) REFERENCES roles(n_id) ON DELETE RESTRICT
);

-- -----------------------------------------
-- 프로덕트
-- -----------------------------------------
CREATE TABLE products (
  n_id            INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  str_name        VARCHAR(100)  NOT NULL UNIQUE,
  str_description TEXT          NULL,
  str_db_type     VARCHAR(20)   NOT NULL,
  dt_created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 프로덕트별 서비스 (기존 arr_services JSON 분리)
CREATE TABLE product_services (
  n_id         INT         NOT NULL AUTO_INCREMENT PRIMARY KEY,
  n_product_id INT         NOT NULL,
  str_abbr     VARCHAR(50)  NOT NULL,
  str_region   VARCHAR(50)  NOT NULL,
  UNIQUE KEY uq_product_abbr_region (n_product_id, str_abbr, str_region),
  FOREIGN KEY (n_product_id) REFERENCES products(n_id) ON DELETE CASCADE
);

-- -----------------------------------------
-- 쿼리 템플릿
-- -----------------------------------------
CREATE TABLE event_templates (
  n_id              INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  n_product_id      INT           NOT NULL,
  str_product_name  VARCHAR(100)  NOT NULL,
  str_event_label   VARCHAR(200)  NOT NULL,
  str_category      VARCHAR(50)   NOT NULL,
  str_type          VARCHAR(50)   NOT NULL,
  str_input_format  VARCHAR(50)   NOT NULL,
  str_description   TEXT          NULL,
  str_default_items TEXT          NULL,
  str_query_template TEXT        NULL,
  dt_created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (n_product_id) REFERENCES products(n_id) ON DELETE RESTRICT
);

-- -----------------------------------------
-- DB 접속 정보
-- -----------------------------------------
CREATE TABLE db_connections (
  n_id              INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  n_product_id      INT           NOT NULL,
  str_product_name  VARCHAR(100)  NOT NULL,
  str_env           VARCHAR(10)   NOT NULL,
  str_db_type       VARCHAR(20)   NOT NULL,
  str_host          VARCHAR(255)  NOT NULL,
  n_port            INT           NOT NULL,
  str_database      VARCHAR(100)  NOT NULL,
  str_user          VARCHAR(100)  NOT NULL,
  str_password      VARCHAR(255)  NOT NULL,
  b_is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  dt_created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dt_updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (n_product_id) REFERENCES products(n_id) ON DELETE CASCADE,
  UNIQUE KEY uq_product_env (n_product_id, str_env)
);

-- -----------------------------------------
-- 이벤트 인스턴스 (처리자 FK, arr_status_logs 제거)
-- -----------------------------------------
CREATE TABLE event_instances (
  n_id                      INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  n_event_template_id       INT           NOT NULL,
  n_product_id              INT           NOT NULL,
  str_event_label           VARCHAR(200)  NOT NULL,
  str_product_name          VARCHAR(100)  NOT NULL,
  str_service_abbr          VARCHAR(50)   NOT NULL,
  str_service_region        VARCHAR(50)   NOT NULL,
  str_category              VARCHAR(50)   NOT NULL,
  str_type                  VARCHAR(50)   NOT NULL,
  str_event_name            VARCHAR(200)  NOT NULL,
  str_input_values          TEXT          NULL,
  str_generated_query       LONGTEXT      NULL,
  dt_deploy_date            DATETIME      NOT NULL,
  str_status                VARCHAR(30)   NOT NULL DEFAULT 'event_created',

  -- 처리자 (기존 obj_* JSON → FK)
  n_creator_user_id         INT           NULL,
  n_confirmer_user_id       INT           NULL,
  n_qa_requester_user_id    INT           NULL,
  n_qa_deployer_user_id     INT           NULL,
  n_qa_verifier_user_id     INT           NULL,
  n_live_requester_user_id  INT           NULL,
  n_live_deployer_user_id   INT           NULL,
  n_live_verifier_user_id   INT           NULL,

  str_created_by            VARCHAR(100)  NOT NULL,
  n_created_by_user_id      INT           NOT NULL,
  dt_created_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (n_event_template_id) REFERENCES event_templates(n_id) ON DELETE RESTRICT,
  FOREIGN KEY (n_product_id) REFERENCES products(n_id) ON DELETE RESTRICT,
  FOREIGN KEY (n_created_by_user_id) REFERENCES users(n_id) ON DELETE RESTRICT,
  FOREIGN KEY (n_creator_user_id) REFERENCES users(n_id) ON DELETE SET NULL,
  FOREIGN KEY (n_confirmer_user_id) REFERENCES users(n_id) ON DELETE SET NULL,
  FOREIGN KEY (n_qa_requester_user_id) REFERENCES users(n_id) ON DELETE SET NULL,
  FOREIGN KEY (n_qa_deployer_user_id) REFERENCES users(n_id) ON DELETE SET NULL,
  FOREIGN KEY (n_qa_verifier_user_id) REFERENCES users(n_id) ON DELETE SET NULL,
  FOREIGN KEY (n_live_requester_user_id) REFERENCES users(n_id) ON DELETE SET NULL,
  FOREIGN KEY (n_live_deployer_user_id) REFERENCES users(n_id) ON DELETE SET NULL,
  FOREIGN KEY (n_live_verifier_user_id) REFERENCES users(n_id) ON DELETE SET NULL,

  INDEX idx_status (str_status),
  INDEX idx_product_id (n_product_id),
  INDEX idx_created_by (n_created_by_user_id),
  INDEX idx_created_at (dt_created_at)
);

-- 인스턴스별 반영 범위 (기존 arr_deploy_scope JSON 분리)
CREATE TABLE instance_deploy_scopes (
  n_instance_id INT         NOT NULL,
  str_env        VARCHAR(10) NOT NULL COMMENT 'qa | live',
  PRIMARY KEY (n_instance_id, str_env),
  FOREIGN KEY (n_instance_id) REFERENCES event_instances(n_id) ON DELETE CASCADE
);

-- 인스턴스 상태 변경 로그 (기존 arr_status_logs JSON 분리) — 이벤트 로그 핵심
CREATE TABLE instance_status_logs (
  n_id                  INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  n_instance_id          INT           NOT NULL,
  str_status             VARCHAR(30)   NOT NULL,
  n_changed_by_user_id   INT           NOT NULL,
  str_comment            TEXT          NULL,
  dt_changed_at          DATETIME      NOT NULL,

  FOREIGN KEY (n_instance_id) REFERENCES event_instances(n_id) ON DELETE CASCADE,
  FOREIGN KEY (n_changed_by_user_id) REFERENCES users(n_id) ON DELETE RESTRICT,
  INDEX idx_instance_id (n_instance_id),
  INDEX idx_changed_by (n_changed_by_user_id),
  INDEX idx_dt_changed (dt_changed_at),
  INDEX idx_status (str_status)
);

-- 실행 결과 (qa_deployed / live_deployed 시 1:1, 선택)
CREATE TABLE instance_execution_results (
  n_id                   INT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  n_status_log_id        INT       NOT NULL UNIQUE,
  str_env                VARCHAR(10) NOT NULL COMMENT 'qa | live',
  n_total_affected_rows  INT       NOT NULL DEFAULT 0,
  n_elapsed_ms           INT       NOT NULL DEFAULT 0,
  str_executed_query     LONGTEXT  NULL,
  FOREIGN KEY (n_status_log_id) REFERENCES instance_status_logs(n_id) ON DELETE CASCADE
);

-- 실행 쿼리 단위 결과 (선택, 상세 로그용)
CREATE TABLE execution_query_parts (
  n_id            INT     NOT NULL AUTO_INCREMENT PRIMARY KEY,
  n_result_id     INT     NOT NULL,
  n_index         INT     NOT NULL,
  str_query       LONGTEXT NULL,
  n_affected_rows INT     NOT NULL DEFAULT 0,
  FOREIGN KEY (n_result_id) REFERENCES instance_execution_results(n_id) ON DELETE CASCADE
);

-- -----------------------------------------
-- 감사 로그 (한 사용자 전체 로그: CRUD, 로그인/로그아웃, 권한 수정 등)
-- 이벤트 인스턴스 상태 변경은 instance_status_logs 사용, 나머지는 여기 기록
-- -----------------------------------------
CREATE TABLE audit_logs (
  n_id              INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  n_actor_user_id   INT           NOT NULL COMMENT '행위자 사용자 ID',
  str_entity        VARCHAR(50)   NOT NULL COMMENT 'user|product|db_connection|event_template|role|user_role|login|logout',
  n_entity_id       INT           NULL COMMENT '대상 레코드 PK (login/logout 시 NULL)',
  str_action        VARCHAR(30)   NOT NULL COMMENT 'create|update|delete|login|logout|role_assign|permission_change',
  str_detail        TEXT          NULL COMMENT '요약 또는 변경 설명',
  dt_created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (n_actor_user_id) REFERENCES users(n_id) ON DELETE RESTRICT,
  INDEX idx_actor (n_actor_user_id),
  INDEX idx_entity (str_entity, n_entity_id),
  INDEX idx_dt (dt_created_at)
);

-- =============================================================
-- 시드: 역할 + role_permissions
-- =============================================================
INSERT INTO roles (str_code, str_display_name, str_description, b_is_system) VALUES
('admin', '관리자', '전체 시스템 관리 권한', 1),
('dba', 'DBA', 'DB 쿼리 실행 전담', 1),
('game_manager', 'GM', '게임 운영 관리자', 1),
('game_designer', '기획자', '이벤트 기획 및 생성', 1);

INSERT INTO role_permissions (n_role_id, str_permission)
SELECT n_id, 'product.view' FROM roles WHERE str_code = 'admin'
UNION ALL SELECT n_id, 'product.manage' FROM roles WHERE str_code = 'admin'
UNION ALL SELECT n_id, 'event_template.view' FROM roles WHERE str_code = 'admin'
UNION ALL SELECT n_id, 'event_template.manage' FROM roles WHERE str_code = 'admin'
UNION ALL SELECT n_id, 'user.manage' FROM roles WHERE str_code = 'admin'
UNION ALL SELECT n_id, 'db.manage' FROM roles WHERE str_code = 'admin'
UNION ALL SELECT n_id, 'instance.create' FROM roles WHERE str_code = 'admin'
UNION ALL SELECT n_id, 'instance.approve_qa' FROM roles WHERE str_code = 'admin'
UNION ALL SELECT n_id, 'instance.execute_qa' FROM roles WHERE str_code = 'admin'
UNION ALL SELECT n_id, 'instance.verify_qa' FROM roles WHERE str_code = 'admin'
UNION ALL SELECT n_id, 'instance.approve_live' FROM roles WHERE str_code = 'admin'
UNION ALL SELECT n_id, 'instance.execute_live' FROM roles WHERE str_code = 'admin'
UNION ALL SELECT n_id, 'instance.verify_live' FROM roles WHERE str_code = 'admin';

INSERT INTO role_permissions (n_role_id, str_permission)
SELECT n_id, 'instance.execute_qa' FROM roles WHERE str_code = 'dba'
UNION ALL SELECT n_id, 'instance.execute_live' FROM roles WHERE str_code = 'dba';

INSERT INTO role_permissions (n_role_id, str_permission)
SELECT n_id, 'product.view' FROM roles WHERE str_code = 'game_manager'
UNION ALL SELECT n_id, 'event_template.view' FROM roles WHERE str_code = 'game_manager'
UNION ALL SELECT n_id, 'instance.create' FROM roles WHERE str_code = 'game_manager'
UNION ALL SELECT n_id, 'instance.approve_qa' FROM roles WHERE str_code = 'game_manager'
UNION ALL SELECT n_id, 'instance.verify_qa' FROM roles WHERE str_code = 'game_manager'
UNION ALL SELECT n_id, 'instance.approve_live' FROM roles WHERE str_code = 'game_manager'
UNION ALL SELECT n_id, 'instance.verify_live' FROM roles WHERE str_code = 'game_manager';

INSERT INTO role_permissions (n_role_id, str_permission)
SELECT n_id, 'product.view' FROM roles WHERE str_code = 'game_designer'
UNION ALL SELECT n_id, 'event_template.view' FROM roles WHERE str_code = 'game_designer'
UNION ALL SELECT n_id, 'instance.create' FROM roles WHERE str_code = 'game_designer';

-- 기본 관리자 계정
INSERT INTO users (str_user_id, str_password, str_display_name) VALUES
('admin', '$BCRYPT_HASH_HERE', '관리자');

INSERT INTO user_roles (n_user_id, n_role_id)
SELECT u.n_id, r.n_id FROM users u, roles r WHERE u.str_user_id = 'admin' AND r.str_code = 'admin';
