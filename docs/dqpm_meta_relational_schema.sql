-- =============================================================================
-- DQPM 메타 DB — 정규화 스키마 (backend/data/*.json 구조와 1:1 대응)
-- =============================================================================
-- 런타임 DDL은 `backend/src/db/mysqlAppSchema.ts` 의 `ARR_MYSQL_APP_DDL` 과 동기 유지.
-- 테이블명에 `dqpm_` 접두사 없음. `product.str_name` 은 동명 제품 허용(UNIQUE 없음).
-- DB 생성 예: CREATE DATABASE dqpm_meta …; USE dqpm_meta;
-- MySQL 8.0+ 권장
-- =============================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS product (
  n_id              INT           NOT NULL PRIMARY KEY COMMENT 'JSON nId',
  str_name          VARCHAR(200)  NOT NULL,
  str_description   TEXT          NULL,
  str_db_type       VARCHAR(32)   NOT NULL COMMENT 'mysql | mssql 등',
  dt_created_at     DATETIME(6)   NOT NULL,
  dt_updated_at     DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='products.json 루트 객체(배열 요소)';

CREATE TABLE IF NOT EXISTS product_service (
  n_id              BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  n_product_id      INT           NOT NULL COMMENT 'JSON nId',
  n_sort            INT           NOT NULL DEFAULT 0 COMMENT 'arrServices 순서',
  str_abbr          VARCHAR(64)   NOT NULL COMMENT 'strAbbr',
  str_region        VARCHAR(64)   NOT NULL COMMENT 'strRegion',
  CONSTRAINT fk_product_service_product
    FOREIGN KEY (n_product_id) REFERENCES product(n_id) ON DELETE CASCADE,
  KEY idx_product_service_product (n_product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='products.json arrServices[]';

CREATE TABLE IF NOT EXISTS users (
  n_id              INT           NOT NULL PRIMARY KEY COMMENT 'JSON nId',
  str_user_id       VARCHAR(64)   NOT NULL,
  str_password      VARCHAR(255)  NOT NULL COMMENT 'bcrypt',
  str_display_name  VARCHAR(200)  NOT NULL,
  dt_created_at     DATETIME(6)   NOT NULL,
  UNIQUE KEY uq_users_str_user_id (str_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='users.json';

CREATE TABLE IF NOT EXISTS roles (
  n_id              INT           NOT NULL PRIMARY KEY COMMENT 'JSON nId',
  str_code          VARCHAR(64)   NOT NULL,
  str_display_name  VARCHAR(200)  NOT NULL,
  str_description   TEXT          NULL,
  b_is_system       TINYINT(1)    NOT NULL DEFAULT 0 COMMENT 'JSON bIsSystem',
  dt_created_at     DATETIME(6)   NOT NULL,
  dt_updated_at     DATETIME(6)   NOT NULL,
  UNIQUE KEY uq_roles_str_code (str_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='roles.json';

CREATE TABLE IF NOT EXISTS user_roles (
  n_user_id         INT           NOT NULL,
  n_role_id         INT           NOT NULL,
  PRIMARY KEY (n_user_id, n_role_id),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (n_user_id) REFERENCES users(n_id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (n_role_id) REFERENCES roles(n_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='userRoles.json { nUserId, nRoleId }';

CREATE TABLE IF NOT EXISTS role_permissions (
  n_role_id         INT           NOT NULL,
  str_permission    VARCHAR(191)  NOT NULL,
  PRIMARY KEY (n_role_id, str_permission),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (n_role_id) REFERENCES roles(n_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='rolePermissions.json';

CREATE TABLE IF NOT EXISTS db_connection (
  n_id              INT           NOT NULL PRIMARY KEY COMMENT 'JSON nId',
  n_product_id      INT           NOT NULL,
  str_product_name  VARCHAR(200)  NOT NULL,
  str_kind          VARCHAR(16)   NOT NULL DEFAULT 'GAME' COMMENT 'GAME|WEB|LOG',
  str_env           VARCHAR(16)   NOT NULL COMMENT 'dev|qa|live',
  str_db_type       VARCHAR(16)   NOT NULL COMMENT 'mssql|mysql',
  str_host          VARCHAR(255)  NOT NULL,
  n_port            INT           NOT NULL,
  str_database      VARCHAR(128)  NOT NULL,
  str_user          VARCHAR(128)  NOT NULL,
  str_password      VARCHAR(512)  NOT NULL COMMENT '평문·암호화 정책은 앱 레벨',
  b_is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  dt_created_at     DATETIME(6)   NOT NULL,
  dt_updated_at     DATETIME(6)   NOT NULL,
  CONSTRAINT fk_db_connection_product FOREIGN KEY (n_product_id) REFERENCES product(n_id) ON DELETE CASCADE,
  KEY idx_db_connection_product_env (n_product_id, str_env, b_is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='dbConnections.json';

CREATE TABLE IF NOT EXISTS event_template (
  n_id                INT           NOT NULL PRIMARY KEY COMMENT 'JSON nId',
  n_product_id        INT           NOT NULL,
  str_product_name    VARCHAR(200)  NOT NULL,
  str_event_label     VARCHAR(300)  NOT NULL,
  str_description     TEXT          NULL,
  str_category        VARCHAR(64)   NOT NULL,
  str_type            VARCHAR(64)   NOT NULL,
  str_input_format    VARCHAR(64)   NOT NULL,
  str_default_items   TEXT          NULL COMMENT '레거시 단일 필드',
  str_query_template  MEDIUMTEXT    NULL COMMENT '레거시 단일 필드(세트 사용 시 비움)',
  dt_created_at       DATETIME(6)   NOT NULL,
  CONSTRAINT fk_event_template_product FOREIGN KEY (n_product_id) REFERENCES product(n_id) ON DELETE RESTRICT,
  KEY idx_event_template_product (n_product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='events.json 본문(세트 제외)';

CREATE TABLE IF NOT EXISTS event_template_query_set (
  n_id                BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  n_event_template_id INT           NOT NULL,
  n_sort              INT           NOT NULL DEFAULT 0 COMMENT 'arrQueryTemplates 순서',
  n_db_connection_id  INT           NOT NULL COMMENT 'IQueryTemplateItem.nDbConnectionId',
  str_default_items   TEXT          NULL,
  str_query_template  MEDIUMTEXT    NOT NULL,
  CONSTRAINT fk_etqs_template FOREIGN KEY (n_event_template_id) REFERENCES event_template(n_id) ON DELETE CASCADE,
  CONSTRAINT fk_etqs_dbconn FOREIGN KEY (n_db_connection_id) REFERENCES db_connection(n_id) ON DELETE RESTRICT,
  KEY idx_etqs_template (n_event_template_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='events.json arrQueryTemplates[]';

CREATE TABLE IF NOT EXISTS event_instance (
  n_id                      INT           NOT NULL PRIMARY KEY COMMENT 'JSON nId',
  n_event_template_id       INT           NOT NULL,
  n_product_id              INT           NOT NULL,
  str_event_label           VARCHAR(300)  NOT NULL,
  str_product_name          VARCHAR(200)  NOT NULL,
  str_service_abbr          VARCHAR(64)   NOT NULL,
  str_service_region        VARCHAR(64)   NOT NULL,
  str_category              VARCHAR(64)   NOT NULL,
  str_type                  VARCHAR(64)   NOT NULL,
  str_event_name            VARCHAR(300)  NOT NULL,
  str_input_values          TEXT          NULL,
  str_generated_query       MEDIUMTEXT    NULL,
  dt_deploy_date            DATETIME(6)   NOT NULL COMMENT 'JSON dtDeployDate',
  dt_qa_deploy_date         DATETIME(6)   NULL,
  dt_live_deploy_date       DATETIME(6)   NULL,
  str_allo_link             VARCHAR(1024) NULL,
  str_status                VARCHAR(32)   NOT NULL,
  str_created_by            VARCHAR(200)  NOT NULL,
  n_created_by_user_id      INT           NOT NULL,
  dt_created_at             DATETIME(6)   NOT NULL,
  b_permanently_removed     TINYINT(1)    NOT NULL DEFAULT 0,
  dt_permanently_removed_at DATETIME(6)   NULL,
  CONSTRAINT fk_ei_template FOREIGN KEY (n_event_template_id) REFERENCES event_template(n_id) ON DELETE RESTRICT,
  CONSTRAINT fk_ei_product FOREIGN KEY (n_product_id) REFERENCES product(n_id) ON DELETE RESTRICT,
  CONSTRAINT fk_ei_creator_user FOREIGN KEY (n_created_by_user_id) REFERENCES users(n_id) ON DELETE RESTRICT,
  KEY idx_ei_status (str_status),
  KEY idx_ei_product (n_product_id),
  KEY idx_ei_created_by (n_created_by_user_id),
  KEY idx_ei_created_at (dt_created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='eventInstances.json 스칼라 필드';

CREATE TABLE IF NOT EXISTS event_instance_deploy_scope (
  n_instance_id     INT           NOT NULL,
  str_scope         VARCHAR(8)    NOT NULL COMMENT 'qa | live',
  PRIMARY KEY (n_instance_id, str_scope),
  CONSTRAINT fk_eids_instance FOREIGN KEY (n_instance_id) REFERENCES event_instance(n_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='JSON arrDeployScope[]';

CREATE TABLE IF NOT EXISTS event_instance_execution_target (
  n_id              BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  n_instance_id     INT           NOT NULL,
  n_sort            INT           NOT NULL DEFAULT 0,
  n_db_connection_id INT          NOT NULL,
  str_query         MEDIUMTEXT    NOT NULL,
  CONSTRAINT fk_eiet_instance FOREIGN KEY (n_instance_id) REFERENCES event_instance(n_id) ON DELETE CASCADE,
  CONSTRAINT fk_eiet_dbconn FOREIGN KEY (n_db_connection_id) REFERENCES db_connection(n_id) ON DELETE RESTRICT,
  KEY idx_eiet_instance (n_instance_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='JSON arrExecutionTargets[]';

CREATE TABLE IF NOT EXISTS event_instance_status_log (
  n_id                  BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  n_instance_id         INT           NOT NULL,
  n_sort                INT           NOT NULL DEFAULT 0 COMMENT 'arrStatusLogs 순서',
  str_status            VARCHAR(32)   NOT NULL,
  str_changed_by        VARCHAR(200)  NOT NULL,
  n_changed_by_user_id  INT           NOT NULL,
  str_comment           TEXT          NULL,
  dt_changed_at         DATETIME(6)   NOT NULL,
  json_execution_result JSON         NULL COMMENT 'IStatusLog.objExecutionResult',
  CONSTRAINT fk_eisl_instance FOREIGN KEY (n_instance_id) REFERENCES event_instance(n_id) ON DELETE CASCADE,
  KEY idx_eisl_instance_time (n_instance_id, dt_changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='JSON arrStatusLogs[]';

CREATE TABLE IF NOT EXISTS event_instance_stage_actor (
  n_instance_id       INT           NOT NULL,
  str_stage           VARCHAR(32)   NOT NULL COMMENT 'creator|confirmer|...',
  str_display_name    VARCHAR(200)  NOT NULL,
  n_user_id           INT           NOT NULL,
  str_user_id         VARCHAR(64)   NOT NULL,
  dt_processed_at     DATETIME(6)   NOT NULL,
  PRIMARY KEY (n_instance_id, str_stage),
  CONSTRAINT fk_eisa_instance FOREIGN KEY (n_instance_id) REFERENCES event_instance(n_id) ON DELETE CASCADE,
  CONSTRAINT fk_eisa_user FOREIGN KEY (n_user_id) REFERENCES users(n_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='JSON objCreator 등 IStageActor';

CREATE TABLE IF NOT EXISTS activity_log (
  n_id              BIGINT        NOT NULL PRIMARY KEY COMMENT 'JSON nId',
  dt_at             DATETIME(6)   NOT NULL,
  str_method        VARCHAR(16)   NOT NULL,
  str_path          VARCHAR(512)  NOT NULL,
  n_status_code     INT           NOT NULL,
  n_actor_user_id   INT           NULL,
  str_actor_user_id VARCHAR(64)   NULL,
  str_category      VARCHAR(16)   NOT NULL COMMENT 'auth|event|user|ops|other',
  json_actor_roles  JSON          NULL COMMENT 'arrActorRoles[]',
  KEY idx_al_dt (dt_at),
  KEY idx_al_cat_dt (str_category, dt_at),
  KEY idx_al_actor (n_actor_user_id, dt_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='activity_logs.json';

CREATE TABLE IF NOT EXISTS user_ui_preference (
  n_user_id     INT           NOT NULL,
  str_key       VARCHAR(256)  NOT NULL,
  str_value     MEDIUMTEXT    NOT NULL,
  dt_updated_at DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (n_user_id, str_key),
  CONSTRAINT fk_uip_user FOREIGN KEY (n_user_id) REFERENCES users(n_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='userUiPreferences.json mapByUserId';

-- 과거 doc JSON 테이블(dqpm_products 등)·구 UNIQUE(str_name) 가 남아 있으면 수동 DROP / ALTER 권장.
