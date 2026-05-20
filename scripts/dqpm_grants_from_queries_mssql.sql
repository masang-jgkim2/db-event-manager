-- =============================================================================
-- DQPM — QA / LIVE (쿼리 템플릿·실행 이력 91건 기반)
-- 생성: 2026-05-20T06:20:10.136Z
--
-- 선행: master 에 LOGIN [dqpm] 생성 (scripts/dqpm_qa.sql 상단 참고)
-- 적용: QA 또는 LIVE SQL Server 에서 본 파일 실행
--
-- [A] 정적 3-part 이름 테이블
-- [B] DK 월드 DB (ConnectInfo.ServerName 동적 EXEC) — QA dqpm_qa.sql 기준
-- [C] FH 퀘스트 삭제 (@TargetDB 동적 sp_executesql)
-- [D] RESTORE DATABASE (FH 백업 복구 템플릿)
-- =============================================================================

-- [A] 정적 참조 테이블

-- --- AccountDB ---
USE [AccountDB];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'dqpm')
  CREATE USER [dqpm] FOR LOGIN [dqpm];
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[T_AccountCharacter] TO [dqpm];
GO

-- --- atum2_db_1 ---
USE [atum2_db_1];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'dqpm')
  CREATE USER [dqpm] FOR LOGIN [dqpm];
GO

GRANT SELECT, DELETE ON [dbo].[td_Store] TO [dqpm];
GO

-- --- dk_data_release ---
USE [dk_data_release];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'dqpm')
  CREATE USER [dqpm] FOR LOGIN [dqpm];
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[Item] TO [dqpm];
GO

-- --- dk_game_integrate ---
USE [dk_game_integrate];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'dqpm')
  CREATE USER [dqpm] FOR LOGIN [dqpm];
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[ConnectInfo] TO [dqpm];
GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[Inventory] TO [dqpm];
GO

-- [B] DK — ConnectInfo.ServerName 기준 월드 DB (Inventory / WaitWebCashItem)
--     동적 SQL 이므로 테이블 단위 GRANT 대신 db_datareader + db_datawriter 권장
--     LIVE 서버는 dk_game_release_* 목록이 다를 수 있음 → ConnectInfo 조회 후 추가
--     SELECT DISTINCT ServerName FROM dk_game_integrate.dbo.ConnectInfo ORDER BY 1

USE [dk_game_release_233];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'dqpm')
  CREATE USER [dqpm] FOR LOGIN [dqpm];
GO
ALTER ROLE [db_datareader] ADD MEMBER [dqpm];
ALTER ROLE [db_datawriter] ADD MEMBER [dqpm];
GO

USE [dk_game_release_234];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'dqpm')
  CREATE USER [dqpm] FOR LOGIN [dqpm];
GO
ALTER ROLE [db_datareader] ADD MEMBER [dqpm];
ALTER ROLE [db_datawriter] ADD MEMBER [dqpm];
GO

USE [dk_game_release_235];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'dqpm')
  CREATE USER [dqpm] FOR LOGIN [dqpm];
GO
ALTER ROLE [db_datareader] ADD MEMBER [dqpm];
ALTER ROLE [db_datawriter] ADD MEMBER [dqpm];
GO

USE [dk_game_release_236];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'dqpm')
  CREATE USER [dqpm] FOR LOGIN [dqpm];
GO
ALTER ROLE [db_datareader] ADD MEMBER [dqpm];
ALTER ROLE [db_datawriter] ADD MEMBER [dqpm];
GO

USE [dk_game_release_237];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'dqpm')
  CREATE USER [dqpm] FOR LOGIN [dqpm];
GO
ALTER ROLE [db_datareader] ADD MEMBER [dqpm];
ALTER ROLE [db_datawriter] ADD MEMBER [dqpm];
GO

USE [dk_game_release_238];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'dqpm')
  CREATE USER [dqpm] FOR LOGIN [dqpm];
GO
ALTER ROLE [db_datareader] ADD MEMBER [dqpm];
ALTER ROLE [db_datawriter] ADD MEMBER [dqpm];
GO

USE [dk_game_release_239];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'dqpm')
  CREATE USER [dqpm] FOR LOGIN [dqpm];
GO
ALTER ROLE [db_datareader] ADD MEMBER [dqpm];
ALTER ROLE [db_datawriter] ADD MEMBER [dqpm];
GO

USE [dk_game_release_240];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'dqpm')
  CREATE USER [dqpm] FOR LOGIN [dqpm];
GO
ALTER ROLE [db_datareader] ADD MEMBER [dqpm];
ALTER ROLE [db_datawriter] ADD MEMBER [dqpm];
GO

USE [dk_game_release_241];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'dqpm')
  CREATE USER [dqpm] FOR LOGIN [dqpm];
GO
ALTER ROLE [db_datareader] ADD MEMBER [dqpm];
ALTER ROLE [db_datawriter] ADD MEMBER [dqpm];
GO

USE [dk_game_release_242];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'dqpm')
  CREATE USER [dqpm] FOR LOGIN [dqpm];
GO
ALTER ROLE [db_datareader] ADD MEMBER [dqpm];
ALTER ROLE [db_datawriter] ADD MEMBER [dqpm];
GO

USE [dk_game_release_254];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'dqpm')
  CREATE USER [dqpm] FOR LOGIN [dqpm];
GO
ALTER ROLE [db_datareader] ADD MEMBER [dqpm];
ALTER ROLE [db_datawriter] ADD MEMBER [dqpm];
GO

USE [dk_game_release_255];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'dqpm')
  CREATE USER [dqpm] FOR LOGIN [dqpm];
GO
ALTER ROLE [db_datareader] ADD MEMBER [dqpm];
ALTER ROLE [db_datawriter] ADD MEMBER [dqpm];
GO

USE [dk_game_release_luanna];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'dqpm')
  CREATE USER [dqpm] FOR LOGIN [dqpm];
GO
ALTER ROLE [db_datareader] ADD MEMBER [dqpm];
ALTER ROLE [db_datawriter] ADD MEMBER [dqpm];
GO

-- [C] FH 퀘스트 삭제 (FHGame1)

-- --- FHGame1 ---
USE [FHGame1];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'dqpm')
  CREATE USER [dqpm] FOR LOGIN [dqpm];
GO

GRANT SELECT, DELETE ON [dbo].[FH_QUEST] TO [dqpm];
GRANT SELECT, DELETE ON [dbo].[FH_QUEST_DETAIL] TO [dqpm];
GRANT SELECT, DELETE ON [dbo].[FH_QUEST_LINKPROG] TO [dqpm];
GRANT SELECT, DELETE ON [dbo].[FH_QUEST_PROG] TO [dqpm];
GO

-- [D] RESTORE DATABASE
-- ALTER SERVER ROLE [dbcreator] ADD MEMBER [dqpm];
-- GRANT RESTORE DATABASE TO [dqpm];

-- EXECUTE (sp_executesql — 필요 시 DB context 에서 실행)
-- GRANT EXECUTE ON OBJECT::SP_EXECUTESQL TO [dqpm];
-- GRANT EXECUTE ON OBJECT::sp_ExecuteSQL TO [dqpm];
-- GRANT EXECUTE ON OBJECT::sp_ExecuteSql TO [dqpm];
