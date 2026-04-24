/**
 * dbConnections.json 의 평문 strPassword 를 enc:v1 로 일괄 치환.
 * 실행: backend 에서 `DB_CONNECTION_PASSWORD_SECRET`(16자 이상) 설정 후 `npm run encrypt-db-connections-json`
 */
import '../loadEnv';
import fs from 'fs';
import path from 'path';
import { STR_DATA_DIR } from '../data/jsonStore';
import type { IDbConnection } from '../types';
import {
  fnEncryptDbConnPasswordPlain,
  fnIsDbConnPasswordEncrypted,
} from '../services/dbConnectionPasswordCrypto';
import { fnNormalizeConnections } from '../data/dbConnections';

const STR_FILE = 'dbConnections.json';

void (() => {
  try {
    const strP = path.join(STR_DATA_DIR, STR_FILE);
    if (!fs.existsSync(strP)) {
      console.error(`[encrypt-db-conn-json] 파일 없음 | ${strP}`);
      process.exit(1);
    }
    const arrRaw = JSON.parse(fs.readFileSync(strP, 'utf-8')) as IDbConnection[];
    if (!Array.isArray(arrRaw)) {
      console.error('[encrypt-db-conn-json] 루트가 배열이 아님');
      process.exit(1);
    }
    const arrPlain = fnNormalizeConnections(arrRaw);
    let nEnc = 0;
    const arrOut = arrPlain.map((c) => {
      if (fnIsDbConnPasswordEncrypted(c.strPassword)) return c;
      nEnc++;
      return { ...c, strPassword: fnEncryptDbConnPasswordPlain(c.strPassword) };
    });
    fs.writeFileSync(strP, JSON.stringify(arrOut, null, 2), 'utf-8');
    console.log(`[encrypt-db-conn-json] 완료 | 암호화한 행=${nEnc} | 경로=${strP}`);
    process.exit(0);
  } catch (err: unknown) {
    console.error('[encrypt-db-conn-json] 실패 |', (err as Error)?.message);
    process.exit(1);
  }
})();
