/**
 * dbConnections.json 의 strPassword 선택적 암호화(AES-256-GCM).
 * 디스크·MySQL 컬럼에는 `enc:v1:` 접두 + base64, 런타임 인메모리는 항상 평문.
 */
import crypto from 'crypto';

const STR_PREFIX = 'enc:v1:';
const N_IV = 12;
const N_TAG = 16;
const N_MIN_SECRET = 16;

const fnGetKey32 = (): Buffer | null => {
  const strSecret = process.env.DB_CONNECTION_PASSWORD_SECRET?.trim();
  if (!strSecret || strSecret.length < N_MIN_SECRET) return null;
  return crypto.createHash('sha256').update(strSecret, 'utf8').digest();
};

/** .env 에 DB 접속 비밀번호 암호화용 비밀키가 유효하게 있는지 */
export const fnIsDbConnPasswordSecretConfigured = (): boolean => fnGetKey32() !== null;

export const fnIsDbConnPasswordEncrypted = (strStored: string): boolean =>
  Boolean(strStored && strStored.startsWith(STR_PREFIX));

/** 디스크/MySQL에서 읽은 값 → 드라이버용 평문(접두 없으면 그대로) */
export const fnDecryptDbConnPasswordIfNeeded = (strStored: string): string => {
  if (!fnIsDbConnPasswordEncrypted(strStored)) return strStored;
  const bufKey = fnGetKey32();
  if (!bufKey) {
    console.error(
      '[dbConnCrypto] enc:v1 비밀번호인데 DB_CONNECTION_PASSWORD_SECRET 미설정 또는 16자 미만',
    );
    return strStored;
  }
  try {
    const bufRaw = Buffer.from(strStored.slice(STR_PREFIX.length), 'base64');
    if (bufRaw.length < N_IV + N_TAG + 1) return strStored;
    const bufIv = bufRaw.subarray(0, N_IV);
    const bufTag = bufRaw.subarray(N_IV, N_IV + N_TAG);
    const bufEnc = bufRaw.subarray(N_IV + N_TAG);
    const decipher = crypto.createDecipheriv('aes-256-gcm', bufKey, bufIv);
    decipher.setAuthTag(bufTag);
    return Buffer.concat([decipher.update(bufEnc), decipher.final()]).toString('utf8');
  } catch (err: unknown) {
    console.error('[dbConnCrypto] 복호화 실패 |', (err as Error)?.message);
    return strStored;
  }
};

/** JSON/MySQL 저장용(비밀키 없으면 평문 그대로 — 기존 동작) */
export const fnEncryptDbConnPasswordForDisk = (strPlainInMemory: string): string => {
  const bufKey = fnGetKey32();
  if (!bufKey) return strPlainInMemory;
  if (fnIsDbConnPasswordEncrypted(strPlainInMemory)) return strPlainInMemory;
  const bufIv = crypto.randomBytes(N_IV);
  const cipher = crypto.createCipheriv('aes-256-gcm', bufKey, bufIv);
  const bufEnc = Buffer.concat([cipher.update(strPlainInMemory, 'utf8'), cipher.final()]);
  const bufTag = cipher.getAuthTag();
  return STR_PREFIX + Buffer.concat([bufIv, bufTag, bufEnc]).toString('base64');
};

/** CLI·일회성용 — 비밀키 필수 */
export const fnEncryptDbConnPasswordPlain = (strPlain: string): string => {
  const bufKey = fnGetKey32();
  if (!bufKey) {
    throw new Error('DB_CONNECTION_PASSWORD_SECRET 필요(16자 이상)');
  }
  if (fnIsDbConnPasswordEncrypted(strPlain)) return strPlain;
  const bufIv = crypto.randomBytes(N_IV);
  const cipher = crypto.createCipheriv('aes-256-gcm', bufKey, bufIv);
  const bufEnc = Buffer.concat([cipher.update(strPlain, 'utf8'), cipher.final()]);
  const bufTag = cipher.getAuthTag();
  return STR_PREFIX + Buffer.concat([bufIv, bufTag, bufEnc]).toString('base64');
};
