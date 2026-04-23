USE [master]
GO
CREATE LOGIN [dqpm] WITH PASSWORD=N'jgkim212#$' MUST_CHANGE, DEFAULT_DATABASE=[master], CHECK_EXPIRATION=ON, CHECK_POLICY=ON
GO

jgKim212#$

use [cc_tortusa];
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO

use [cc_bonedragon];
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO

use [cc_chartreux];
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO

use [cc_data_main];
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO

USE [cc_data_test]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO

use [cc_dbrestore_main];
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO

use [cc_dbrestore_test];
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO

use [CC_GAMEDB];
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO

use [cc_obt];
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO

use [cc_obt1];
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO

USE [cc_obt2]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO

use [cc_pyron];
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO

use [cc_test];
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO


USE [cc_test2]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO

GO
USE [cc_tortusa]
GO
CREATE USER [dqpm] FOR LOGIN [dqpm]
ALTER ROLE [db_owner] ADD MEMBER [dqpm]
GO