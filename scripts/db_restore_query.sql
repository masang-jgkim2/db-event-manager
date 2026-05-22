USE master;
GO

DECLARE @WinBackupPath NVARCHAR(255) = N'G:\Masang\backup\all\';
DECLARE @WinDataPath   NVARCHAR(255) = N'D:\masang\data\mdf\';
DECLARE @WinLogPath    NVARCHAR(255) = N'F:\Masang\DB\mdf\';

IF OBJECT_ID('tempdb..#BackupList') IS NOT NULL DROP TABLE #BackupList;

CREATE TABLE #BackupList
(
    DbName  SYSNAME NOT NULL,
    BakFile NVARCHAR(4000) NOT NULL
);

INSERT INTO #BackupList (DbName, BakFile)
VALUES
(N'THLogin', N'THLogin_full_20260515.bak'),
(N'cc_dbrestore_main', N'cc_dbrestore_main_full_20260515.bak'),
(N'cc_dbrestore_test', N'cc_dbrestore_test_full_20260515.bak'),
(N'cc_obt', N'cc_obt_full_20260515.bak'),
(N'CC_GAMEDB', N'CC_GAMEDB_full_20260515.bak'),
(N'AccountDB', N'AccountDB_full_20260515.bak'),

(N'dk_data_release_Test', N'dk_data_release_Test_full_20260515.bak'),
(N'dk_game_integrate', N'dk_game_integrate_full_20260515.bak'),
(N'dk_game_release_luanna', N'dk_game_release_luanna_full_20260515.bak'),
(N'dk_game_release_237', N'dk_game_release_237_full_20260515.bak'),
(N'dk_game_release_235', N'dk_game_release_235_full_20260515.bak'),
(N'dk_game_release_233', N'dk_game_release_233_full_20260515.bak'),
(N'dk_game_release_255', N'dk_game_release_255_full_20260515.bak'),
(N'dk_data_release', N'dk_data_release_full_20260515.bak'),
(N'dk_game_release_236', N'dk_game_release_236_full_20260515.bak'),
(N'dk_game_release_238', N'dk_game_release_238_full_20260515.bak'),
(N'dk_game_release_234', N'dk_game_release_234_full_20260515.bak'),
(N'DKGameManager', N'DKGameManager_full_20260515.bak'),
(N'Web_DK', N'Web_DK_full_20260515.bak'),
(N'dk_game_release_239', N'dk_game_release_239_full_20260515.bak'),
(N'dk_game_release_240', N'dk_game_release_240_full_20260515.bak'),
(N'Account', N'Account_full_20260515.bak'),
(N'FHEtl', N'FHEtl_full_20260515.bak'),
(N'FHGame1', N'FHGame1_full_20260515.bak'),
(N'SKID_DB', N'SKID_DB_full_20260515.bak'),
(N'FHLogin', N'FHLogin_full_20260515.bak'),
(N'FHWeb', N'FHWeb_full_20260515.bak'),
(N'LPS_DB', N'LPS_DB_full_20260515.bak'),
(N'MEMBER_DB', N'MEMBER_DB_full_20260515.bak'),
(N'Web_SR', N'Web_SR_full_20260515.bak'),
(N'ClanDB', N'ClanDB_full_20260515.bak'),
(N'atum2_db_1', N'atum2_db_1_full_20260515.bak'),
(N'atum2_db_7', N'atum2_db_7_full_20260515.bak'),
(N'atum2_db_arena', N'atum2_db_arena_full_20260515.bak'),
(N'atum2_db_account', N'atum2_db_account_full_20260515.bak'),
(N'cc_test', N'cc_test_full_20260515.bak'),
(N'cc_data_test', N'cc_data_test_full_20260515.bak'),
(N'cc_data_main', N'cc_data_main_full_20260515.bak'),
(N'dk_game_release_241', N'dk_game_release_241_full_20260515.bak'),
(N'cc_chartreux', N'cc_chartreux_full_20260515.bak'),
(N'cc_pyron', N'cc_pyron_full_20260515.bak'),
(N'cc_stats', N'cc_stats_full_20260515.bak'),
(N'cc_tortusa', N'cc_tortusa_full_20260515.bak'),
(N'cc_bonedragon', N'cc_bonedragon_full_20260515.bak'),
(N'dk_game_release_254', N'dk_game_release_254_full_20260515.bak'),
(N'dk_game_release_242', N'dk_game_release_242_full_20260515.bak')
;

DECLARE 
    @DbName SYSNAME,
    @BakFile NVARCHAR(4000),
    @FullBakPath NVARCHAR(4000),
    @Sql NVARCHAR(MAX),
    @MoveList NVARCHAR(MAX);

DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
SELECT DbName, BakFile
FROM #BackupList
ORDER BY DbName;

OPEN cur;

FETCH NEXT FROM cur INTO @DbName, @BakFile;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @FullBakPath = @WinBackupPath + @BakFile;

    IF OBJECT_ID('tempdb..#FileList') IS NOT NULL DROP TABLE #FileList;

    CREATE TABLE #FileList
    (
        LogicalName NVARCHAR(128),
        PhysicalName NVARCHAR(260),
        [Type] CHAR(1),
        FileGroupName NVARCHAR(128) NULL,
        [Size] NUMERIC(20,0),
        MaxSize NUMERIC(20,0),
        FileId BIGINT,
        CreateLSN NUMERIC(25,0) NULL,
        DropLSN NUMERIC(25,0) NULL,
        UniqueID UNIQUEIDENTIFIER NULL,
        ReadOnlyLSN NUMERIC(25,0) NULL,
        ReadWriteLSN NUMERIC(25,0) NULL,
        BackupSizeInBytes BIGINT NULL,
        SourceBlockSize INT NULL,
        FileGroupId INT NULL,
        LogGroupGUID UNIQUEIDENTIFIER NULL,
        DifferentialBaseLSN NUMERIC(25,0) NULL,
        DifferentialBaseGUID UNIQUEIDENTIFIER NULL,
        IsReadOnly BIT NULL,
        IsPresent BIT NULL,
        TDEThumbprint VARBINARY(32) NULL,
        SnapshotUrl NVARCHAR(360) NULL
    );

    SET @Sql = N'RESTORE FILELISTONLY FROM DISK = N''' 
             + REPLACE(@FullBakPath, '''', '''''') + N'''';

    INSERT INTO #FileList
    EXEC (@Sql);

    ;WITH FileInfo AS
    (
        SELECT
            LogicalName,
            [Type],
            ROW_NUMBER() OVER 
            (
                PARTITION BY [Type] 
                ORDER BY FileId
            ) AS rn
        FROM #FileList
    )
    SELECT @MoveList =
        STUFF
        (
            (
                SELECT 
                    N',
    MOVE N''' + REPLACE(LogicalName, '''', '''''') + N''' TO N''' +
                    CASE 
                        WHEN [Type] = 'L' THEN 
                            @WinLogPath + @DbName + 
                            CASE WHEN rn = 1 THEN N'_log.ldf'
                                 ELSE N'_log_' + CAST(rn AS NVARCHAR(10)) + N'.ldf'
                            END
                        ELSE 
                            @WinDataPath + @DbName + 
                            CASE WHEN rn = 1 THEN N'.mdf'
                                 ELSE N'_' + CAST(rn AS NVARCHAR(10)) + N'.ndf'
                            END
                    END + N''''
                FROM FileInfo
                FOR XML PATH(''), TYPE
            ).value('.', 'NVARCHAR(MAX)'),
            1, 2, N''
        );

    PRINT N'=========================================';
    PRINT N'Restore DB : ' + @DbName;
    PRINT N'Backup    : ' + @FullBakPath;

    IF DB_ID(@DbName) IS NOT NULL
    BEGIN
        SET @Sql = N'
ALTER DATABASE ' + QUOTENAME(@DbName) + N' SET SINGLE_USER WITH ROLLBACK IMMEDIATE;';
        EXEC (@Sql);
    END

    SET @Sql = N'
RESTORE DATABASE ' + QUOTENAME(@DbName) + N'
FROM DISK = N''' + REPLACE(@FullBakPath, '''', '''''') + N'''
WITH 
    ' + @MoveList + N',
    REPLACE,
    RECOVERY,
    STATS = 10;';

    PRINT @Sql;
    EXEC (@Sql);

    SET @Sql = N'
ALTER DATABASE ' + QUOTENAME(@DbName) + N' SET MULTI_USER;';
    EXEC (@Sql);

    FETCH NEXT FROM cur INTO @DbName, @BakFile;
END

CLOSE cur;
DEALLOCATE cur;
GO