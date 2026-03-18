restore filelistonly from DISK = N'G:\Masang\backup\fh\FHGame1_full_20260305_050017.bak'
RESTORE DATABASE [FHGame1] FILE = N'FHGame1' FROM  DISK = N'G:\Masang\backup\fh\FHGame1_full_20260305_050017.bak' WITH  FILE = 1
,  MOVE N'FHGame1' TO N'G:\Masang\data\mdf\FHGame1.mdf'
,  MOVE N'FHGame1_log' TO N'G:\Masang\data\mdf\FHGame1_log.ldf',  NOUNLOAD,  STATS = 10, replace
GO


select count(*) FROM FHGame1.dbo.FH_QUEST WHERE QUESTID IN ( 42001, 42002, 42003, 42004, 42005, 42006, 42007, 42008, 42009, 42010, 42011, 42012, 42013, 42014, 42015, 42016, 42017, 42018, 45035, 45036, 45037, 45038, 45039, 45040, 45041, 45042, 45043, 45044, 45045, 45046 );
select count(*) FROM FHGame1.dbo.FH_QUEST_DETAIL WHERE QUESTID IN ( 42001, 42002, 42003, 42004, 42005, 42006, 42007, 42008, 42009, 42010, 42011, 42012, 42013, 42014, 42015, 42016, 42017, 42018, 45035, 45036, 45037, 45038, 45039, 45040, 45041, 45042, 45043, 45044, 45045, 45046 );
select count(*) FROM FHGame1.dbo.FH_QUEST_LINKPROG WHERE LST_COMPL_QUESTID IN ( 42001, 42002, 42003, 42004, 42005, 42006, 42007, 42008, 42009, 42010, 42011, 42012, 42013, 42014, 42015, 42016, 42017, 42018, 45035, 45036, 45037, 45038, 45039, 45040, 45041, 45042, 45043, 45044, 45045, 45046 );
select count(*) FROM FHGame1.dbo.FH_QUEST_PROG WHERE QUESTID IN ( 42001, 42002, 42003, 42004, 42005, 42006, 42007, 42008, 42009, 42010, 42011, 42012, 42013, 42014, 42015, 42016, 42017, 42018, 45035, 45036, 45037, 45038, 45039, 45040, 45041, 45042, 45043, 45044, 45045, 45046 );



USE master;
---------------------------------------------------------------------------------------------------------------------------------------
-- 2026년 1월 8일, 12월 어워드 이벤트가 종료됨에 따라, 하위 이벤트 퀘스트 33종 삭제 요청 드립니다. 
-- 초기화 퀘스트  인덱스 : 42001, 42002, 42003, 42004, 42005, 42006, 42007, 42008, 42009, 42010, 42011, 42012, 42013, 42014, 42015, 42016, 42017, 42018, 45035, 45036, 45037, 45038, 45039, 45040, 45041, 45042, 45043, 45044, 45045, 45046

---------------------------------------------------------------------------------------------------------------------------------------
--초기화 대상 퀘스트 :
-- 42001   NPC 미미, 빨강 구슬 장식 10개 -> 요리상자 1개
-- 42002  NPC 미미, 빨강 구슬 장식 50개 -> 요리상자 5개
-- 42003  NPC 미미, 빨강 구슬 장식 100개 -> 요리상자 10개
-- 42004  NPC 미미, 파랑 구슬 장식 5개 -> 요리상자 1개
-- 42005  NPC 미미, 파랑 구슬 장식 25개 -> 요리상자 5개
-- 42006  NPC 미미, 파랑 구슬 장식 50개 -> 요리상자 10개
-- 42007  NPC 미미, 루돌프 인형 3개 -> 요리상자 1개
-- 42008  NPC 미미, 루돌프 인형 15개 -> 요리상자 5개
-- 42009  NPC 미미, 루돌프 인형 30개 -> 요리상자 10개
-- 42010   NPC 미미, 눈꽃 조각 3개 -> 요리상자 1개
-- 42011    NPC 미미, 눈꽃 조각 15개 -> 요리상자 5개
-- 42012   NPC 미미, 눈꽃 조각 30개 -> 요리상자 10개
-- 42013   NPC 미미, 빨강 구슬 장식 10개 -> 루돌프 인형 1개
-- 42014   NPC 미미, 빨강 구슬 장식 50개 -> 루돌프 인형 5개
-- 42015   NPC 미미, 빨강 구슬 장식 100개 -> 루돌프 인형 10개
-- 42016   NPC 미미, 파랑 구슬 장식 10개 -> 눈꽃 조각 1개
-- 42017   NPC 미미, 파랑 구슬 장식 50개 -> 눈꽃 조각 5개
-- 42018   NPC 미미, 파랑 구슬 장식 100개 -> 눈꽃 조각 10개
-- 45035  NPC 제니에게 5강화 단계 부여 옵션 변경 교환권 1개 가져다주기 1
-- 45036  NPC 제니에게 5강화 단계 부여 옵션 변경 교환권 1개 가져다주기 2
-- 45037  NPC 제니에게 5강화 단계 부여 옵션 변경 교환권 1개 가져다주기 3
-- 45038  NPC 제니에게 7강화 단계 부여 옵션 변경 교환권 1개 가져다주기 1
-- 45039  NPC 제니에게 7강화 단계 부여 옵션 변경 교환권 1개 가져다주기 2
-- 45040  NPC 제니에게 7강화 단계 부여 옵션 변경 교환권 1개 가져다주기 3
-- 45041   NPC 제니에게 9강화 단계 부여 옵션 변경 교환권 1개 가져다주기 1
-- 45042  NPC 제니에게 9강화 단계 부여 옵션 변경 교환권 1개 가져다주기 2
-- 45043  NPC 제니에게 9강화 단계 부여 옵션 변경 교환권 1개 가져다주기 3
-- 45044  NPC 제니에게 10강화 단계 부여 옵션 변경 교환권 1개 가져다주기 1
-- 45045  NPC 제니에게 10강화 단계 부여 옵션 변경 교환권 1개 가져다주기 2
-- 45046  NPC 제니에게 10강화 단계 부여 옵션 변경 교환권 1개 가져다주기 3

---------------------------------------------------------------------------------------------------------------------------------------
--라이브 적용 시점 : 2026년 1월 8일 목요일 정기 점검
--QA 빌드 예정일 : 2025년 12월 18일 목요일
---------------------------------------------------------------------------------------------------------------------------------------

-- [1.처리 대상 식별값 입력]
DECLARE @IndexString NVARCHAR(MAX) = {{items}};
DROP TABLE IF EXISTS ##IndexList;
CREATE TABLE ##IndexList (
	RowIndex INT IDENTITY(0, 1)
,	TargetID INT
);
INSERT INTO ##IndexList
SELECT TRIM(value)
	FROM STRING_SPLIT(@IndexString, ',');

-- [2.처리 대상 DB, 테이블, 행 입력]
DECLARE @TargetDB NVARCHAR(32) = 'FHGame1';

DECLARE @TargetTable TABLE ( 
	RowIndex INT IDENTITY(0, 1)
,	TableName NVARCHAR(64)
,	ColumnName NVARCHAR(64)
);
INSERT INTO @TargetTable VALUES
	('FH_QUEST', 'QUESTID')
,	('FH_QUEST_DETAIL', 'QUESTID')
,	('FH_QUEST_LINKPROG', 'LST_COMPL_QUESTID')
,	('FH_QUEST_PROG', 'QUESTID')
;

/* [3.처리할 구문 입력]
	- T : 테이블
	- C : 행 (Column)
	- Arg : 대상 식별값
*/
DECLARE @ExecuteString NVARCHAR(MAX) = CONCAT( 'DELETE FROM ', @TargetDB, '.dbo.{T} WHERE {C} IN ( {Arg} );' );

-- 조회문 작성
DECLARE @DQ_Count NVARCHAR(MAX) = '';
SELECT @DQ_Count = CONCAT( @DQ_Count, '
SELECT	', TT.RowIndex, ' AS TableOrder
	,	''', TT.TableName, ''' AS TableName
	,	''', TT.ColumnName, ''' AS IndexName
	,	IL.TargetID AS IndexValue
	,	COUNT(TT.', TT.ColumnName, ') AS IndexCount
	FROM	[', @TargetDB, '].[dbo].[', TT.TableName, '] AS TT
		INNER JOIN ##IndexList AS IL
			ON TT.', TT.ColumnName, ' = IL.TargetID
		GROUP BY IL.TargetID
UNION ALL')
	FROM	@TargetTable AS TT;

SET @DQ_Count = TRIM('UNION ALL' FROM @DQ_Count);
SET @DQ_Count = CONCAT( '
WITH CTE_Result AS 
( ', @DQ_Count, ' )
SELECT	TableName, IndexName, IndexValue, IndexCount
	FROM CTE_Result
		ORDER BY TableOrder' );

-- 처리문 작성
DECLARE @DQ_Execute NVARCHAR(MAX) = '';
SELECT @DQ_Execute = CONCAT( @DQ_Execute, '
',	REPLACE( REPLACE( REPLACE( @ExecuteString
		, '{T}', TableName 
	)	, '{C}', ColumnName
	)	, '{Arg}', @IndexString 
	))
	FROM @TargetTable;
	
-- 조회 : 처리 전
-- PRINT @DQ_Count;
EXEC sp_ExecuteSql @DQ_Count;

-- 처리 진행
BEGIN TRY
	BEGIN TRAN
		-- PRINT @DQ_Execute;
		EXEC sp_ExecuteSql @DQ_Execute;
	COMMIT TRAN
END TRY
BEGIN CATCH
	ROLLBACK TRAN
END CATCH

-- 조회 : 처리 후
-- PRINT @DQ_Count;
EXEC sp_ExecuteSql @DQ_Count;