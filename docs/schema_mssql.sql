-- =============================================================
-- Database Query Process Manager (DQPM) - MSSQL 스키마 (db_manager)
-- 핵심 3개 테이블: roles, users, db_connections
-- 실행 전 db_manager 데이터베이스를 먼저 생성해주세요.
-- =============================================================

USE db_manager;
GO

-- =============================================================
-- 역할 테이블
-- =============================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='roles' AND xtype='U')
CREATE TABLE roles (
  n_id             INT           IDENTITY(1,1) PRIMARY KEY,
  str_code         NVARCHAR(50)  NOT NULL UNIQUE,
  str_display_name NVARCHAR(100) NOT NULL,
  str_description  NVARCHAR(MAX) NULL,
  arr_permissions  NVARCHAR(MAX) NOT NULL DEFAULT '[]',  -- JSON 배열 (TPermission[])
  b_is_system      BIT           NOT NULL DEFAULT 0,     -- 1이면 삭제 불가
  dt_created_at    DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
  dt_updated_at    DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO

-- =============================================================
-- 사용자 테이블
-- =============================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
CREATE TABLE users (
  n_id             INT           IDENTITY(1,1) PRIMARY KEY,
  str_user_id      NVARCHAR(50)  NOT NULL UNIQUE,           -- 로그인 ID (변경 불가)
  str_password     NVARCHAR(255) NOT NULL,                  -- bcrypt 해시
  str_display_name NVARCHAR(100) NOT NULL,
  arr_roles        NVARCHAR(MAX) NOT NULL DEFAULT '[]',     -- JSON 배열 (역할 코드 배열)
  dt_created_at    DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO

-- =============================================================
-- DB 접속 정보 테이블
-- =============================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='db_connections' AND xtype='U')
CREATE TABLE db_connections (
  n_id             INT           IDENTITY(1,1) PRIMARY KEY,
  n_product_id     INT           NOT NULL,
  str_product_name NVARCHAR(100) NOT NULL,
  str_env          NVARCHAR(10)  NOT NULL,    -- dev | qa | live
  str_db_type      NVARCHAR(20)  NOT NULL,    -- mssql | mysql
  str_host         NVARCHAR(255) NOT NULL,
  n_port           INT           NOT NULL,
  str_database     NVARCHAR(100) NOT NULL,
  str_user         NVARCHAR(100) NOT NULL,
  str_password     NVARCHAR(255) NOT NULL,    -- 평문 저장 (추후 AES 암호화 권장)
  b_is_active      BIT           NOT NULL DEFAULT 1,
  dt_created_at    DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
  dt_updated_at    DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
  CONSTRAINT uq_product_env UNIQUE (n_product_id, str_env)  -- 프로덕트당 환경 1개
);
GO

-- =============================================================
-- 시드 데이터: 역할 4종 (이미 존재하면 SKIP)
-- =============================================================
IF NOT EXISTS (SELECT 1 FROM roles WHERE str_code = 'admin')
INSERT INTO roles (str_code, str_display_name, str_description, arr_permissions, b_is_system)
VALUES (
  'admin', N'관리자', N'전체 시스템 관리 권한',
  '["product.view","product.manage","event_template.view","event_template.manage","user.manage","db.manage","instance.create","instance.approve_qa","instance.execute_qa","instance.verify_qa","instance.approve_live","instance.execute_live","instance.verify_live"]',
  1
);

IF NOT EXISTS (SELECT 1 FROM roles WHERE str_code = 'dba')
INSERT INTO roles (str_code, str_display_name, str_description, arr_permissions, b_is_system)
VALUES (
  'dba', N'DBA', N'DB 쿼리 실행 전담',
  '["instance.execute_qa","instance.execute_live"]',
  1
);

IF NOT EXISTS (SELECT 1 FROM roles WHERE str_code = 'game_manager')
INSERT INTO roles (str_code, str_display_name, str_description, arr_permissions, b_is_system)
VALUES (
  'game_manager', N'GM', N'게임 운영 관리자',
  '["product.view","event_template.view","instance.create","instance.approve_qa","instance.verify_qa","instance.approve_live","instance.verify_live"]',
  1
);

IF NOT EXISTS (SELECT 1 FROM roles WHERE str_code = 'game_designer')
INSERT INTO roles (str_code, str_display_name, str_description, arr_permissions, b_is_system)
VALUES (
  'game_designer', N'기획자', N'이벤트 기획 및 생성',
  '["product.view","event_template.view","instance.create"]',
  1
);
GO

-- =============================================================
-- 시드 데이터: 기본 관리자 계정 (admin / admin123)
-- 비밀번호 해시: bcrypt(admin123, 10)
-- =============================================================
IF NOT EXISTS (SELECT 1 FROM users WHERE str_user_id = 'admin')
INSERT INTO users (str_user_id, str_password, str_display_name, arr_roles)
VALUES (
  'admin',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWq',  -- admin123
  N'관리자',
  '["admin"]'
);
GO

PRINT N'db_manager 스키마 초기화 완료';
GO
