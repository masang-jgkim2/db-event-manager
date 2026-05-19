USE [master]
GO
CREATE LOGIN [dqpm] WITH PASSWORD=N'dqpm123!@#', DEFAULT_DATABASE=[master], CHECK_EXPIRATION=OFF, CHECK_POLICY=OFF
GO
use [LPS_DB];
GO
USE [Account]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [Account]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [Account];
GO
USE [AccountDB]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [AccountDB]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [AccountDB];
GO
USE [atum2_db_1]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [atum2_db_1]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [atum2_db_1];
GO
USE [atum2_db_7]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [atum2_db_7]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [atum2_db_7];
GO
USE [atum2_db_account]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [atum2_db_account]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [atum2_db_account];
GO
USE [atum2_db_arena]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [atum2_db_arena]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [atum2_db_arena];
GO
USE [cc_bonedragon]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [cc_bonedragon]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [cc_bonedragon];
GO
USE [cc_chartreux]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [cc_chartreux]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [cc_chartreux];
GO
USE [cc_data_main]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [cc_data_main]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [cc_data_main];
GO
USE [cc_data_test]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [cc_data_test]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [cc_data_test];
GO
USE [cc_dbrestore_main]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [cc_dbrestore_main]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [cc_dbrestore_main];
GO
USE [cc_dbrestore_test]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [cc_dbrestore_test]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [cc_dbrestore_test];
GO
USE [CC_GAMEDB]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [CC_GAMEDB]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [CC_GAMEDB];
GO
USE [cc_obt]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [cc_obt]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [cc_obt];
GO
USE [cc_pyron]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [cc_pyron]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [cc_pyron];
GO
USE [cc_stats]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [cc_stats]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [cc_stats];
GO
USE [cc_test]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [cc_test]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [cc_test];
GO
USE [cc_tortusa]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [cc_tortusa]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [cc_tortusa];
GO
USE [ccc_tritona]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [ccc_tritona]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [ccc_tritona];
GO
USE [ClanDB]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [ClanDB]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [ClanDB];
GO
USE [dk_data_release]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [dk_data_release]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [dk_data_release];
GO
USE [dk_data_release_Test]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [dk_data_release_Test]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [dk_data_release_Test];
GO
USE [dk_game_integrate]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [dk_game_integrate]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [dk_game_integrate];
GO
USE [dk_game_release_233]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [dk_game_release_233]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [dk_game_release_233];
GO
USE [dk_game_release_234]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [dk_game_release_234]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [dk_game_release_234];
GO
USE [dk_game_release_235]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [dk_game_release_235]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [dk_game_release_235];
GO
USE [dk_game_release_236]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [dk_game_release_236]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [dk_game_release_236];
GO
USE [dk_game_release_237]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [dk_game_release_237]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [dk_game_release_237];
GO
USE [dk_game_release_238]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [dk_game_release_238]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [dk_game_release_238];
GO
USE [dk_game_release_239]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [dk_game_release_239]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [dk_game_release_239];
GO
USE [dk_game_release_240]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [dk_game_release_240]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [dk_game_release_240];
GO
USE [dk_game_release_241]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [dk_game_release_241]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [dk_game_release_241];
GO
USE [dk_game_release_242]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [dk_game_release_242]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [dk_game_release_242];
GO
USE [dk_game_release_254]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [dk_game_release_254]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [dk_game_release_254];
GO
USE [dk_game_release_255]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [dk_game_release_255]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [dk_game_release_255];
GO
USE [dk_game_release_luanna]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [dk_game_release_luanna]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [dk_game_release_luanna];
GO
USE [DKGameManager]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [DKGameManager]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [DKGameManager];
GO
USE [FHEtl]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [FHEtl]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [FHEtl];
GO
USE [FHGame1]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [FHGame1]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [FHGame1];
GO
USE [FHLogin]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [FHLogin]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [FHLogin];
GO
USE [FHWeb]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [FHWeb]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [FHWeb];
GO
USE [LPS_DB]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [LPS_DB]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [LPS_DB];
GO
USE [MEMBER_DB]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [MEMBER_DB]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [MEMBER_DB];
GO
USE [SKID_DB]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [SKID_DB]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [SKID_DB];
GO
USE [THLogin]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [THLogin]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [THLogin];
GO
USE [Web_DK]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [Web_DK]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
use [Web_DK];
GO
USE [Web_SR]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
GO
USE [Web_SR]
GO
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO
