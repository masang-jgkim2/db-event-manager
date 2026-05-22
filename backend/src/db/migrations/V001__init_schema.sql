-- =============================================================
-- V001: 초기 스키마 — roles, users, db_connections 테이블 생성
-- =============================================================

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='roles' AND xtype='U')
CREATE TABLE roles (
  n_id             INT           IDENTITY(1,1) PRIMARY KEY,
  str_code         NVARCHAR(50)  NOT NULL UNIQUE,
  str_display_name NVARCHAR(100) NOT NULL,
  str_description  NVARCHAR(MAX) NULL,
  arr_permissions  NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  b_is_system      BIT           NOT NULL DEFAULT 0,
  dt_created_at    DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
  dt_updated_at    DATETIME2     NOT NULL DEFAULT SYSDATETIME()
)
GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
CREATE TABLE users (
  n_id             INT           IDENTITY(1,1) PRIMARY KEY,
  str_user_id      NVARCHAR(50)  NOT NULL UNIQUE,
  str_password     NVARCHAR(255) NOT NULL,
  str_display_name NVARCHAR(100) NOT NULL,
  arr_roles        NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  dt_created_at    DATETIME2     NOT NULL DEFAULT SYSDATETIME()
)
GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='db_connections' AND xtype='U')
CREATE TABLE db_connections (
  n_id             INT           IDENTITY(1,1) PRIMARY KEY,
  n_product_id     INT           NOT NULL,
  str_product_name NVARCHAR(100) NOT NULL,
  str_env          NVARCHAR(10)  NOT NULL,
  str_db_type      NVARCHAR(20)  NOT NULL,
  str_host         NVARCHAR(255) NOT NULL,
  n_port           INT           NOT NULL,
  str_database     NVARCHAR(100) NOT NULL,
  str_user         NVARCHAR(100) NOT NULL,
  str_password     NVARCHAR(255) NOT NULL,
  b_is_active      BIT           NOT NULL DEFAULT 1,
  dt_created_at    DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
  dt_updated_at    DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
  CONSTRAINT uq_product_env UNIQUE (n_product_id, str_env)
)
GO

-- 역할 시드 데이터
IF NOT EXISTS (SELECT 1 FROM roles WHERE str_code = 'admin')
INSERT INTO roles (str_code, str_display_name, str_description, arr_permissions, b_is_system) VALUES
('admin', N'관리자', N'전체 시스템 관리 권한',
 '["product.view","product.manage","event_template.view","event_template.manage","user.manage","db.manage","instance.create","instance.approve_qa","instance.execute_qa","instance.verify_qa","instance.approve_live","instance.execute_live","instance.verify_live"]',
 1)
GO

IF NOT EXISTS (SELECT 1 FROM roles WHERE str_code = 'dba')
INSERT INTO roles (str_code, str_display_name, str_description, arr_permissions, b_is_system) VALUES
('dba', N'DBA', N'DB 쿼리 실행 전담',
 '["instance.execute_qa","instance.execute_live"]',
 1)
GO

IF NOT EXISTS (SELECT 1 FROM roles WHERE str_code = 'game_manager')
INSERT INTO roles (str_code, str_display_name, str_description, arr_permissions, b_is_system) VALUES
('game_manager', N'GM', N'게임 운영 관리자',
 '["product.view","event_template.view","instance.create","instance.approve_qa","instance.verify_qa","instance.approve_live","instance.verify_live"]',
 1)
GO

IF NOT EXISTS (SELECT 1 FROM roles WHERE str_code = 'game_designer')
INSERT INTO roles (str_code, str_display_name, str_description, arr_permissions, b_is_system) VALUES
('game_designer', N'기획자', N'이벤트 기획 및 생성',
 '["product.view","event_template.view","instance.create"]',
 1)
GO

-- 기본 사용자 시드 (비밀번호는 서버 시작 시 bcrypt 해시로 삽입됨, 여기선 플레이스홀더)
-- 실제 삽입은 initSchema.ts의 fnInsertSeedUsers() 에서 처리
