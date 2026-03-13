restore filelistonly from DISK = N'G:\Masang\backup\sr\SKID_DB_full_20260311.bak'
RESTORE DATABASE [SKID_DB] FROM  DISK = N'G:\Masang\backup\sr\SKID_DB_full_20260311.bak' WITH  FILE = 1
,  MOVE N'SKID_DB' TO N'G:\Masang\data\mdf\SKID_DB.mdf'
,  MOVE N'SKID_DB_log' TO N'G:\Masang\data\mdf\SKID_DB_log.ldf',  NOUNLOAD,  STATS = 10, replace
GO


-- [설정 : 대상 ID]
DROP TABLE IF EXISTS ##TargetItem;
CREATE TABLE ##TargetItem (
	RowNum		INT IDENTITY(1, 1)		PRIMARY KEY
,	TargetID	VARCHAR(32)		-- ** 탐색할 ID 타입에 따라 변경 **
);

INSERT INTO ##TargetItem ( TargetID ) VALUES
('i_n_milk_choco_2012')
,('i_n_shell_choco_2012')
,('i_n_ball_choco_2012')
,('i_n_make_ngiftbox_2012')
,('i_n_make_sgiftbox_2012')
,('i_n_make_ugiftbox_2012')
,('i_n_get_ngiftbox_2012')
,('i_n_get_sgiftbox_2012')
,('i_n_get_ugiftbox_2012')
,('i_n_choco_nrecipe_2012')
,('i_n_choco_srecipe_2012')
,('i_n_choco_urecipe_2012')
,('i_n_love_point_2012')
,('i_n_love_giftbox_2012')
,('i_n_milk_choco_2012_end')
,('i_n_shell_choco_2012_end')
,('i_n_ball_choco_2012_end')
,('i_n_make_ngiftbox_2012_end')
,('i_n_make_sgiftbox_2012_end')
,('i_n_make_ugiftbox_2012_end')
,('i_n_get_ngiftbox_2012_end')
,('i_n_get_sgiftbox_2012_end')
,('i_n_get_ugiftbox_2012_end')
,('i_n_love_giftbox_2012_end')
,('careful_wrapping')
,('twinkling_wrapping')
,('i_n_e_hb_box_box');




select count(*) FROM SKID_DB.dbo.SKID_AUCTION_TB WHERE ITEMID IN ( SELECT TargetID FROM ##TargetItem ); 
select count(*) FROM SKID_DB.dbo.SKID_ITEM_TB WHERE ITEMID IN ( SELECT TargetID FROM ##TargetItem ); 
select count(*) FROM SKID_DB.dbo.SKID_VSITEM_TB WHERE ITEMID IN ( SELECT TargetID FROM ##TargetItem ); 
select count(*) FROM SKID_DB.dbo.SKID_MSG_TB 
WHERE ITEM LIKE 'i_n_milk_choco_2012%' OR ITEM LIKE 'i_n_shell_choco_2012%' OR ITEM LIKE 'i_n_ball_choco_2012%' OR ITEM LIKE 'i_n_make_ngiftbox_2012%' OR ITEM LIKE 'i_n_make_sgiftbox_2012%' OR ITEM LIKE 'i_n_make_ugiftbox_2012%' OR ITEM LIKE 'i_n_get_ngiftbox_2012%' OR ITEM LIKE 'i_n_get_sgiftbox_2012%' OR ITEM LIKE 'i_n_get_ugiftbox_2012%' OR ITEM LIKE 'i_n_choco_nrecipe_2012%' OR ITEM LIKE 'i_n_choco_srecipe_2012%' OR ITEM LIKE 'i_n_choco_urecipe_2012%' OR ITEM LIKE 'i_n_love_point_2012%' OR ITEM LIKE 'i_n_love_giftbox_2012%' OR ITEM LIKE 'i_n_milk_choco_2012_end%' OR ITEM LIKE 'i_n_shell_choco_2012_end%' OR ITEM LIKE 'i_n_ball_choco_2012_end%' OR ITEM LIKE 'i_n_make_ngiftbox_2012_end%' OR ITEM LIKE 'i_n_make_sgiftbox_2012_end%' OR ITEM LIKE 'i_n_make_ugiftbox_2012_end%' OR ITEM LIKE 'i_n_get_ngiftbox_2012_end%' OR ITEM LIKE 'i_n_get_sgiftbox_2012_end%' OR ITEM LIKE 'i_n_get_ugiftbox_2012_end%' OR ITEM LIKE 'i_n_love_giftbox_2012_end%' OR ITEM LIKE 'careful_wrapping%' OR ITEM LIKE 'twinkling_wrapping%' OR ITEM LIKE 'i_n_e_hb_box_box%';


/*


-- SKID_MSG_TB 업데이트
UPDATE M
SET M.ITEM = (SELECT TOP 1 TargetID FROM ##TargetItem ORDER BY NEWID())
FROM (SELECT TOP 100 * FROM SKID_DB.dbo.SKID_MSG_TB ORDER BY NEWID()) AS M;



-- SKID_VSITEM_TB 업데이트
UPDATE V
SET V.ItemID = (SELECT TOP 1 TargetID FROM ##TargetItem ORDER BY NEWID())
FROM (SELECT TOP 100 * FROM SKID_DB.dbo.SKID_VSITEM_TB ORDER BY NEWID()) AS V;

-- SKID_ITEM_TB 업데이트
UPDATE I
SET I.ItemID = (SELECT TOP 1 TargetID FROM ##TargetItem ORDER BY NEWID())
FROM (SELECT TOP 100 * FROM SKID_DB.dbo.SKID_ITEM_TB ORDER BY NEWID()) AS I;


-- SKID_AUCTION_TB 업데이트
UPDATE A
SET A.ItemID = (SELECT TOP 1 TargetID FROM ##TargetItem ORDER BY NEWID())
FROM (SELECT TOP 100 * FROM SKID_DB.dbo.SKID_AUCTION_TB ORDER BY NEWID()) AS A;



-- [설정 : 대상 DB]
DROP TABLE IF EXISTS ##TargetDB;
CREATE TABLE ##TargetDB (
	RowNum		INT IDENTITY(1, 1)		PRIMARY KEY
,	TargetDB	VARCHAR(32)
);
INSERT INTO ##TargetDB (TargetDB) VALUES
('SKID_DB');

-- [설정 : 대상 테이블, 탐색 양식]
DROP TABLE IF EXISTS ##TargetTable;
CREATE TABLE ##TargetTable (
	RowNum			INT IDENTITY(1, 1)	PRIMARY KEY
,	TableName		NVARCHAR(64)
,	TargetColumn	NVARCHAR(64)
,	FormatProcess	NVARCHAR(MAX)		-- {C}:TargetColumn, {I}:TargetIDs, {T}:TableName, {W}:FormatWhere
,	FormatWhere		NVARCHAR(MAX)		-- {C}:TargetColumn, {I}:TargetIDs, {T}:TableName
,	Separator		VARCHAR(MAX)		-- {C}:TargetColumn
);

INSERT INTO ##TargetTable (TableName, TargetColumn, FormatProcess, FormatWhere, Separator) VALUES
 ('SKID_AUCTION_TB', 'ITEMID'
	, 'DELETE FROM {T} WHERE {W}'
	, '{C} IN ( SELECT TargetID FROM ##TargetItem )'
	, NULL )
,('SKID_ITEM_TB', 'ITEMID'
	, 'DELETE FROM {T} WHERE {W}'
	, '{C} IN ( SELECT TargetID FROM ##TargetItem )'
	, NULL )
,('SKID_VSITEM_TB', 'ITEMID'
	, 'DELETE FROM {T} WHERE {W}'
	, '{C} IN ( SELECT TargetID FROM ##TargetItem )'
	, NULL )
,('SKID_MSG_TB', 'ITEM'
	, 'UPDATE {T} SET {C} = '''' WHERE {W}'
	, '{C} LIKE ''{I}%'''
	, '%'' OR {C} LIKE ''' )
;
*/