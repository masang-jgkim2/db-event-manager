USE master;
GO

-- [설정 : 적용 여부]
DECLARE @IsCommit TINYINT = 1;
DECLARE @IsDebug TINYINT = 1;

-- [설정 : 대상 ID]
DROP TABLE IF EXISTS ##TargetItem;
CREATE TABLE ##TargetItem (
	RowNum		INT IDENTITY(1, 1)		PRIMARY KEY
,	TargetID	INT		-- ** 탐색할 ID 타입에 따라 변경 **
);
INSERT INTO ##TargetItem ( TargetID ) VALUES
(11357)
,(11359)
,(11360)
,(11361);

-- [설정 : 대상 DB]
DROP TABLE IF EXISTS ##TargetDB;
CREATE TABLE ##TargetDB (
	RowNum		INT IDENTITY(1, 1)		PRIMARY KEY
,	TargetDB	VARCHAR(32)
);
INSERT INTO ##TargetDB (TargetDB) VALUES
	('cc_obt')
,	('cc_tortusa')
,	('cc_tritona')
,	('cc_pyron')
,	('cc_test');

-- [설정 : 대상 테이블, 탐색 양식]
DROP TABLE IF EXISTS ##TargetTable;
CREATE TABLE ##TargetTable (
	RowNum			INT IDENTITY(1, 1)	PRIMARY KEY
,	TableName		NVARCHAR(64)
,	TargetColumn	NVARCHAR(64)
,	FormatProcess	NVARCHAR(MAX)		-- {DB}:[TargetDB], {C}:[TargetColumn], {I}:TargetIDs, {T}:[TableName], {W}:[FormatWhere]
,	FormatWhere		NVARCHAR(MAX)		-- {DB}:[TargetDB], {C}:[TargetColumn], {I}:TargetIDs, {T}:[TableName]
,	Separator		VARCHAR(MAX)		-- {C}:[TargetColumn]
);

INSERT INTO ##TargetTable (TableName, TargetColumn, FormatProcess, FormatWhere, Separator) VALUES
 ('dt_CharacterItem_New', 'ItemTemplateID'
	, 'UPDATE {T} SET Deleted = 2 WHERE {W}'
	, '{C} IN ( SELECT TargetID FROM ##TargetItem ) AND ( Deleted <> 2 )'
	, NULL )
,('UT_Auction_New', 'ItemTID'
	, 'DELETE FROM {T} WHERE {W}'
	, '{C} IN ( SELECT TargetID FROM ##TargetItem )'
	, NULL )
,('UT_MailAddItem', 'ItemUID'
	, 'DELETE FROM {T} WHERE {W}'
	, '{C} IN ( SELECT ItemUniqueID FROM {DB}.dbo.UT_MailAddItem_Send WHERE ItemTemplateID IN( {I} ) )'
	, ', ' )
,('UT_MailAddItem_Send', 'ItemTemplateID'
	, 'DELETE FROM {T} WHERE {W}'
	, '{C} IN ( SELECT TargetID FROM ##TargetItem )'
	, NULL )
;
-- 쿼리 작성 : 구분자
DECLARE @IsForcedSep TINYINT = IIF(EXISTS(SELECT TOP(1) * FROM ##TargetTable WHERE Separator IS NOT NULL), 0, 1);

DECLARE @DQuery_Sep NVARCHAR(MAX) = '';
SELECT	@DQuery_Sep = STRING_AGG( CONCAT( @DQuery_Sep, '
SELECT	', RowNum, ' AS RowRef
	,	STRING_AGG( TargetID, ''', REPLACE( REPLACE( Separator
	,	'''', '''''' )
	,	'{C}', TargetColumn )
	,	''' ) AS ConSep
	FROM ##TargetItem'), '
UNION ALL' )
	FROM ##TargetTable
		WHERE (1 = @IsForcedSep) OR (Separator IS NOT NULL)
	
DROP TABLE IF EXISTS ##TableSep;
SET @DQuery_Sep = CONCAT('
WITH CTE_ConSep AS
( ', @DQuery_Sep, '
)
SELECT *
INTO ##TableSep
	FROM CTE_ConSep
');

IF( 0 < @IsDebug ) SELECT @DQuery_Sep AS [@DQuery_Sep]
EXEC sp_ExecuteSQL @DQuery_Sep;

-- 쿼리 작성 : 조회
DECLARE @DQuery_SELECT NVARCHAR(MAX) = '';
SELECT	@DQuery_SELECT = STRING_AGG( REPLACE( REPLACE( REPLACE( REPLACE( CONCAT( @DQuery_SELECT, '
SELECT	', TD.RowNum, ' AS DBRow
	,	', TT.RowNum, ' AS TableRow
	,	TSource.{C} AS TargetID
	,	COUNT(TSource.{C}) AS TargetCount
	FROM ', TD.TargetDB, '.dbo.',  TT.TableName,' AS TSource
		WHERE ', TT.FormatWhere, '
		GROUP BY TSource.{C}')
		,	'{I}', ISNULL(TS.ConSep, ''))
		,	'{T}', TT.TableName)
		,	'{C}', TT.TargetColumn)
		,	'{DB}', TD.TargetDB)
		, '
UNION ALL')
	FROM ##TargetDB AS TD
		CROSS JOIN ##TargetTable AS TT
		LEFT JOIN ##TableSep AS TS
			ON TT.RowNum = TS.RowRef
		WHERE	DB_ID( TD.TargetDB ) IS NOT NULL
			
SET @DQuery_SELECT = CONCAT('
WITH CTE_Result AS
( ', @DQuery_SELECT, '
)
SELECT	TD.RowNum AS DBRow
	,	TT.RowNum AS TableRow
	,	TI.RowNum AS ItemRow
	,	TD.TargetDB
	,	TT.TableName AS TargetTable
	,	TI.TargetID
	,	ISNULL(TargetCount, 0) AS TargetCount
	FROM CTE_Result AS CR
		RIGHT JOIN ##TargetItem AS TI
			ON	TI.TargetID = CR.TargetID
		CROSS JOIN ##TargetDB AS TD
		CROSS JOIN ##TargetTable AS TT
		WHERE	DB_ID( TD.TargetDB ) IS NOT NULL
		ORDER BY TD.RowNum, TT.RowNum, TI.RowNum
')

-- 쿼리 작성 : 적용
DECLARE @DQuery_PROCESS NVARCHAR(MAX) = '';
SELECT	@DQuery_PROCESS = STRING_AGG( REPLACE( REPLACE( REPLACE( REPLACE( REPLACE( CONCAT( @DQuery_PROCESS, FormatProcess, ';' )
		,	'{W}', TT.FormatWhere)
		,	'{I}', ISNULL(TS.ConSep, '(ERROR)'))
		,	'{T}', CONCAT( TD.TargetDB, '.dbo.', TT.TableName ) )
		,	'{C}', TT.TargetColumn)
		,	'{DB}', TD.TargetDB)
		,	'
')
	FROM ##TargetDB AS TD
		CROSS JOIN ##TargetTable AS TT
		LEFT JOIN ##TableSep AS TS
			ON TT.RowNum = TS.RowRef
		WHERE	DB_ID( TD.TargetDB ) IS NOT NULL

-- 조회 : 적용 전
IF( 0 < @IsDebug ) SELECT @DQuery_SELECT AS [@DQuery_SELECT]
IF( 0 = @IsDebug ) EXEC sp_ExecuteSQL @DQuery_SELECT

BEGIN TRY
BEGIN TRAN

	-- 적용 진행
	IF( 0 < @IsDebug ) SELECT @DQuery_PROCESS AS [@DQuery_PROCESS]
	IF( 0 = @IsDebug ) EXEC sp_ExecuteSQL @DQuery_PROCESS

	-- 조회 : 적용 후
	IF( 0 < @IsDebug ) SELECT @DQuery_SELECT AS [@DQuery_SELECT]
	IF( 0 = @IsDebug ) EXEC sp_ExecuteSQL @DQuery_SELECT

	IF( 0 < @IsCommit )
	BEGIN
		SELECT 'Run complate' AS 'Do : COMMIT';
		COMMIT TRAN
	END
	ELSE
	BEGIN
		SELECT IIF( 0 < @IsCommit, 'Error on run', 'Commit canceled ( 0 < @IsCommit )') AS 'Do : ROLLBACK';
		ROLLBACK TRAN
	END
	
END TRY
BEGIN CATCH
		SELECT	'Error on run' AS 'Do : ROLLBACK'
			,	ERROR_MESSAGE() AS 'ErrorMessage';
		ROLLBACK TRAN
END CATCH