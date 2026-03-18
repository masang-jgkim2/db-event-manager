restore filelistonly from DISK = N'G:\Masang\backup\dk\dk_game_release_234_full_20250807_050011.bak'
restore filelistonly from DISK = N'G:\Masang\backup\dk\dk_game_release_235_full_20250807_050011.bak'
restore filelistonly from DISK = N'G:\Masang\backup\dk\dk_game_release_236_full_20250807_050011.bak'
restore filelistonly from DISK = N'G:\Masang\backup\dk\dk_game_release_237_full_20250807_050011.bak'
restore filelistonly from DISK = N'G:\Masang\backup\dk\dk_game_release_238_full_20250807_050011.bak'
restore filelistonly from DISK = N'G:\Masang\backup\dk\dk_game_release_239_full_20250807_050011.bak'
restore filelistonly from DISK = N'G:\Masang\backup\dk\dk_game_release_240_full_20250807_050011.bak'
restore filelistonly from DISK = N'G:\Masang\backup\dk\dk_game_release_241_full_20250807_050011.bak'
restore filelistonly from DISK = N'G:\Masang\backup\dk\dk_game_release_255_full_20250807_050011.bak'
restore filelistonly from DISK = N'G:\Masang\backup\dk\dk_game_release_luanna_full_20250807_050011.bak'

RESTORE DATABASE [dk_game_release_234] FROM  DISK = N'G:\Masang\backup\dk\dk_game_release_234_full_20250807_050011.bak' WITH  FILE = 1
,  MOVE N'AG' TO N'G:\Masang\data\mdf\dk_game_release_234.mdf'
,  MOVE N'AG_log' TO N'G:\Masang\data\mdf\dk_game_release_234.ldf',  NOUNLOAD,  STATS = 10, replace
GO
RESTORE DATABASE [dk_game_release_235] FROM  DISK = N'G:\Masang\backup\dk\dk_game_release_235_full_20250807_050011.bak' WITH  FILE = 1
,  MOVE N'AG' TO N'G:\Masang\data\mdf\dk_game_release_235.mdf'
,  MOVE N'AG_log' TO N'G:\Masang\data\mdf\dk_game_release_235.ldf',  NOUNLOAD,  STATS = 10, replace
GO
RESTORE DATABASE [dk_game_release_236] FROM  DISK = N'G:\Masang\backup\dk\dk_game_release_236_full_20250807_050011.bak' WITH  FILE = 1
,  MOVE N'AG' TO N'G:\Masang\data\mdf\dk_game_release_236.mdf'
,  MOVE N'AG_log' TO N'G:\Masang\data\mdf\dk_game_release_236.ldf',  NOUNLOAD,  STATS = 10, replace
GO
RESTORE DATABASE [dk_game_release_237] FROM  DISK = N'G:\Masang\backup\dk\dk_game_release_237_full_20250807_050011.bak' WITH  FILE = 1
,  MOVE N'AG' TO N'G:\Masang\data\mdf\dk_game_release_237.mdf'
,  MOVE N'AG_log' TO N'G:\Masang\data\mdf\dk_game_release_237.ldf',  NOUNLOAD,  STATS = 10, replace
GO
RESTORE DATABASE [dk_game_release_238] FROM  DISK = N'G:\Masang\backup\dk\dk_game_release_238_full_20250807_050011.bak' WITH  FILE = 1
,  MOVE N'AG' TO N'G:\Masang\data\mdf\dk_game_release_238.mdf'
,  MOVE N'AG_log' TO N'G:\Masang\data\mdf\dk_game_release_238.ldf',  NOUNLOAD,  STATS = 10, replace
GO
RESTORE DATABASE [dk_game_release_239] FROM  DISK = N'G:\Masang\backup\dk\dk_game_release_239_full_20250807_050011.bak' WITH  FILE = 1
,  MOVE N'AG' TO N'G:\Masang\data\mdf\dk_game_release_239.mdf'
,  MOVE N'AG_log' TO N'G:\Masang\data\mdf\dk_game_release_239.ldf',  NOUNLOAD,  STATS = 10, replace
GO
RESTORE DATABASE [dk_game_release_240] FROM  DISK = N'G:\Masang\backup\dk\dk_game_release_240_full_20250807_050011.bak' WITH  FILE = 1
,  MOVE N'AG' TO N'G:\Masang\data\mdf\dk_game_release_240.mdf'
,  MOVE N'AG_log' TO N'G:\Masang\data\mdf\dk_game_release_240.ldf',  NOUNLOAD,  STATS = 10, replace
GO
RESTORE DATABASE [dk_game_release_241] FROM  DISK = N'G:\Masang\backup\dk\dk_game_release_241_full_20250807_050011.bak' WITH  FILE = 1
,  MOVE N'AG' TO N'G:\Masang\data\mdf\dk_game_release_241.mdf'
,  MOVE N'AG_log' TO N'G:\Masang\data\mdf\dk_game_release_241.ldf',  NOUNLOAD,  STATS = 10, replace
GO
RESTORE DATABASE [dk_game_release_255] FROM  DISK = N'G:\Masang\backup\dk\dk_game_release_255_full_20250807_050011.bak' WITH  FILE = 1
,  MOVE N'AG' TO N'G:\Masang\data\mdf\dk_game_release_255.mdf'
,  MOVE N'AG_log' TO N'G:\Masang\data\mdf\dk_game_release_255.ldf',  NOUNLOAD,  STATS = 10, replace
GO
RESTORE DATABASE [dk_game_release_luanna] FROM  DISK = N'G:\Masang\backup\dk\dk_game_release_luanna_full_20250807_050011.bak' WITH  FILE = 1
,  MOVE N'AG' TO N'G:\Masang\data\mdf\dk_game_release_luanna.mdf'
,  MOVE N'AG_log' TO N'G:\Masang\data\mdf\dk_game_release_luanna.ldf',  NOUNLOAD,  STATS = 10, replace
GO
