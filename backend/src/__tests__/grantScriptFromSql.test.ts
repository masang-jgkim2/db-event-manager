import {
  fnBuildMssqlGrantScriptForSql,
  fnExtractMssqlDatabaseNames,
  fnExtractMssqlTableRefs,
} from '../utils/grantScriptFromSql';

describe('grantScriptFromSql', () => {
  it('FH @TargetDB + @TargetTable 패턴에서 FHGame1·퀘스트 테이블 추출', () => {
    const strSql = `
DECLARE @TargetDB NVARCHAR(32) = 'FHGame1';
INSERT INTO @TargetTable VALUES
  ('FH_QUEST', 'QUESTID'),
  ('FH_QUEST_DETAIL', 'QUESTID');
USE [FHGame1];
DELETE FROM dbo.FH_QUEST WHERE 1=0;
`;
    expect(fnExtractMssqlDatabaseNames(strSql)).toContain('FHGame1');
    const arrTables = fnExtractMssqlTableRefs(strSql);
    expect(arrTables.map((t) => t.strTable)).toEqual(
      expect.arrayContaining(['FH_QUEST', 'FH_QUEST_DETAIL']),
    );
    const obj = fnBuildMssqlGrantScriptForSql(strSql, 'dqpm');
    expect(obj.strScript).toContain('USE [FHGame1]');
    expect(obj.strScript).toContain('CREATE USER [dqpm]');
    expect(obj.strScript).toContain('GRANT SELECT, DELETE ON [dbo].[FH_QUEST]');
  });
});
