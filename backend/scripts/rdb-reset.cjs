/**
 * 시스템 MSSQL(dbo) 앱 테이블 데이터 전부 삭제 — 스키마·_migrations 유지.
 * 다음 서버 기동(STORE_BACKEND=rdb) 시 테이블이 비어 있으면 하이드레이트가 건너뛰고 JSON(data/)이 기준이 됨.
 *
 * 사용: backend 디렉터리에서
 *   node scripts/rdb-reset.cjs --yes
 * 환경: .env 의 DB_SYSTEM_* (dotenv 자동 로드)
 */
const path = require('path');
const fs = require('fs');

const strEnvPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(strEnvPath)) {
  require('dotenv').config({ path: strEnvPath });
} else {
  require('dotenv').config();
}

const sql = require('mssql');

const STR_BATCH = `
SET NOCOUNT ON;
BEGIN TRY
  BEGIN TRAN;

  IF OBJECT_ID('dbo.event_instances', 'U') IS NOT NULL DELETE FROM dbo.event_instances;
  IF OBJECT_ID('dbo.event_templates', 'U') IS NOT NULL DELETE FROM dbo.event_templates;
  IF OBJECT_ID('dbo.user_roles', 'U') IS NOT NULL DELETE FROM dbo.user_roles;
  IF OBJECT_ID('dbo.role_permissions', 'U') IS NOT NULL DELETE FROM dbo.role_permissions;
  IF OBJECT_ID('dbo.db_connections', 'U') IS NOT NULL DELETE FROM dbo.db_connections;
  IF OBJECT_ID('dbo.users', 'U') IS NOT NULL DELETE FROM dbo.users;
  IF OBJECT_ID('dbo.roles', 'U') IS NOT NULL DELETE FROM dbo.roles;
  IF OBJECT_ID('dbo.products', 'U') IS NOT NULL DELETE FROM dbo.products;

  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
`;

async function main() {
  const bYes = process.argv.includes('--yes') || process.argv.includes('-y');
  if (!bYes) {
    console.error('[rdb-reset] 데이터 삭제를 진행하려면 인자로 --yes 를 붙이세요.');
    console.error('  예: node scripts/rdb-reset.cjs --yes');
    process.exit(1);
  }

  const objConfig = {
    server: process.env.DB_SYSTEM_HOST || '127.0.0.1',
    port: Number(process.env.DB_SYSTEM_PORT) || 1433,
    database: process.env.DB_SYSTEM_DATABASE || 'db_manager',
    user: process.env.DB_SYSTEM_USER || 'dba',
    password: process.env.DB_SYSTEM_PASSWORD || '',
    options: {
      trustServerCertificate: true,
      enableArithAbort: true,
      encrypt: false,
    },
  };

  console.log('[rdb-reset] 연결:', {
    server: objConfig.server,
    port: objConfig.port,
    database: objConfig.database,
    user: objConfig.user,
  });

  const pool = await new sql.ConnectionPool(objConfig).connect();
  try {
    await pool.request().query(STR_BATCH);
    console.log('[rdb-reset] 완료 — event_instances, event_templates, user_roles, role_permissions, db_connections, users, roles, products 행 삭제');
    console.log('[rdb-reset] _migrations 는 유지됩니다. 스키마 재적용이 필요하면 DB를 새로 만들거나 마이그레이션 기록을 별도 정리하세요.');
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[rdb-reset] 실패 |', err.message);
  process.exit(1);
});
