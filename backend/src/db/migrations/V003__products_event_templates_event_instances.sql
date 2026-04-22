-- 프로덕트·쿼리 템플릿·이벤트 인스턴스 (STORE_BACKEND=rdb)

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='products' AND xtype='U')
CREATE TABLE products (
  n_id             INT            NOT NULL PRIMARY KEY,
  str_name         NVARCHAR(200)  NOT NULL,
  str_description  NVARCHAR(MAX)  NULL,
  str_db_type      NVARCHAR(20)   NOT NULL,
  arr_services     NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_products_arr_services DEFAULT (N'[]'),
  dt_created_at    DATETIME2      NOT NULL
);
GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='event_templates' AND xtype='U')
CREATE TABLE event_templates (
  n_id                  INT            NOT NULL PRIMARY KEY,
  n_product_id          INT            NOT NULL,
  str_product_name      NVARCHAR(200)  NOT NULL,
  str_event_label       NVARCHAR(400)  NOT NULL,
  str_description       NVARCHAR(MAX)  NULL,
  str_category          NVARCHAR(100)  NOT NULL,
  str_type              NVARCHAR(100)  NOT NULL,
  str_input_format      NVARCHAR(100)  NOT NULL,
  str_default_items     NVARCHAR(MAX)  NULL,
  str_query_template    NVARCHAR(MAX)  NULL,
  arr_query_templates   NVARCHAR(MAX)  NULL,
  dt_created_at         DATETIME2      NOT NULL,
  CONSTRAINT FK_event_templates_products FOREIGN KEY (n_product_id) REFERENCES dbo.products(n_id)
);
GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='event_instances' AND xtype='U')
CREATE TABLE event_instances (
  n_id         INT           NOT NULL PRIMARY KEY,
  str_payload  NVARCHAR(MAX) NOT NULL
);
GO
