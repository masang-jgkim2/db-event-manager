/** MSSQL GRANT 스크립트용 테이블 참조 */
export interface IMssqlTableRef {
  strSchema: string;
  strTable: string;
}

const fnNormalizeIdent = (strRaw: string): string => strRaw.replace(/^\[|\]$/g, '').trim();

/** USE [db], @TargetDB = 'FHGame1' 등 대상 DB명 */
export const fnExtractMssqlDatabaseNames = (strSql: string): string[] => {
  const setSeen = new Set<string>();
  const arrOut: string[] = [];
  const fnAdd = (strDb: string): void => {
    const strN = fnNormalizeIdent(strDb);
    if (!strN || strN.toLowerCase() === 'master') return;
    const strKey = strN.toLowerCase();
    if (setSeen.has(strKey)) return;
    setSeen.add(strKey);
    arrOut.push(strN);
  };

  const reUse = /\bUSE\s+(?:\[([^\]]+)\]|(\w+))/gi;
  let m: RegExpExecArray | null;
  while ((m = reUse.exec(strSql)) !== null) {
    fnAdd(m[1] || m[2]);
  }

  const reTarget = /@TargetDB\s+\w+\s*=\s*N?'([^']+)'/gi;
  while ((m = reTarget.exec(strSql)) !== null) {
    fnAdd(m[1]);
  }

  return arrOut;
};

/** INSERT INTO @TargetTable VALUES ('FH_QUEST', 'QUESTID') 패턴 */
export const fnExtractTargetTableNamesFromInsert = (strSql: string): string[] => {
  const setSeen = new Set<string>();
  const arrOut: string[] = [];
  const re = /\(\s*N?'([^']+)'\s*,\s*N?'[^']+'\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(strSql)) !== null) {
    const strT = fnNormalizeIdent(m[1]);
    if (!strT || strT.startsWith('@')) continue;
    const strKey = strT.toLowerCase();
    if (setSeen.has(strKey)) continue;
    setSeen.add(strKey);
    arrOut.push(strT);
  }
  return arrOut;
};

/** 실행 쿼리에서 물리 테이블명 추출 (임시·테이블변수 제외) */
export const fnExtractMssqlTableRefs = (strSql: string): IMssqlTableRef[] => {
  const setSeen = new Set<string>();
  const arrOut: IMssqlTableRef[] = [];
  const re = /\b(?:FROM|JOIN|INTO|UPDATE|DELETE\s+FROM)\s+([^\s;,()]+)/gi;

  const fnAdd = (strSchema: string, strTable: string): void => {
    const strS = fnNormalizeIdent(strSchema);
    const strT = fnNormalizeIdent(strTable);
    if (!strT || strT.startsWith('#') || strT.startsWith('@')) return;
    const strKey = `${strS}.${strT}`.toLowerCase();
    if (setSeen.has(strKey)) return;
    setSeen.add(strKey);
    arrOut.push({ strSchema: strS, strTable: strT });
  };

  let m: RegExpExecArray | null;
  while ((m = re.exec(strSql)) !== null) {
    let strToken = m[1].replace(/,$/, '').trim();
    if (!strToken) continue;
    strToken = strToken.split(/\s+/)[0];
    const arrParts = strToken.split('.').map(fnNormalizeIdent).filter(Boolean);
    if (arrParts.length === 0) continue;
    if (arrParts.length === 1) {
      fnAdd('dbo', arrParts[0]);
    } else if (arrParts.length === 2) {
      fnAdd(arrParts[0], arrParts[1]);
    } else {
      fnAdd(arrParts[arrParts.length - 2], arrParts[arrParts.length - 1]);
    }
  }

  for (const strTable of fnExtractTargetTableNamesFromInsert(strSql)) {
    fnAdd('dbo', strTable);
  }

  return arrOut;
};

/** 로그인에 GRANT 문만 (스키마별) */
export const fnBuildMssqlGrantScript = (
  arrTables: IMssqlTableRef[],
  strLogin: string,
  bDeleteFocused = false,
): string => {
  const strSafeLogin = strLogin.replace(/]/g, '');
  const strPerms = bDeleteFocused ? 'SELECT, DELETE' : 'SELECT, INSERT, UPDATE, DELETE';
  return arrTables
    .map(
      (t) =>
        `GRANT ${strPerms} ON [${t.strSchema}].[${t.strTable}] TO [${strSafeLogin}];`,
    )
    .join('\n');
};

/** USE + CREATE USER + GRANT (오류 916 대응용 전체 스크립트) */
export const fnBuildMssqlGrantScriptForSql = (
  strSql: string,
  strLogin: string,
): { strScript: string; nTableCount: number; arrDatabases: string[] } => {
  const arrDbs = fnExtractMssqlDatabaseNames(strSql);
  const arrTables = fnExtractMssqlTableRefs(strSql);
  const bDeleteFocused = fnExtractTargetTableNamesFromInsert(strSql).length > 0;
  const strSafeLogin = strLogin.replace(/]/g, '');

  if (arrTables.length === 0) {
    return {
      strScript: '-- 쿼리에서 GRANT 대상 테이블을 찾지 못했습니다.',
      nTableCount: 0,
      arrDatabases: arrDbs,
    };
  }

  const strGrants = fnBuildMssqlGrantScript(arrTables, strLogin, bDeleteFocused);
  const strDb = arrDbs[0];
  if (!strDb) {
    return {
      strScript: `-- DB명(USE/@TargetDB)이 없어 GRANT만 생성합니다.\n${strGrants}`,
      nTableCount: arrTables.length,
      arrDatabases: [],
    };
  }

  const strScript = [
    `-- 오류 916 방지: [${strDb}] 에 로그인 [${strSafeLogin}] DB 사용자·권한 (DBA/dbo 권한으로 실행)`,
    `-- RESTORE DATABASE 직후에는 사용자가 사라지므로 복구 직후에 다시 실행하세요.`,
    `USE [${strDb}];`,
    'GO',
    `IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'${strSafeLogin}')`,
    `  CREATE USER [${strSafeLogin}] FOR LOGIN [${strSafeLogin}];`,
    'GO',
    strGrants,
    'GO',
  ].join('\n');

  return { strScript, nTableCount: arrTables.length, arrDatabases: arrDbs };
};
