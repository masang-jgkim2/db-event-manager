import {
  fnDecryptDbConnPasswordIfNeeded,
  fnEncryptDbConnPasswordForDisk,
  fnEncryptDbConnPasswordPlain,
  fnIsDbConnPasswordSecretConfigured,
} from '../services/dbConnectionPasswordCrypto';

describe('dbConnectionPasswordCrypto', () => {
  const strOld = process.env.DB_CONNECTION_PASSWORD_SECRET;

  afterEach(() => {
    if (strOld !== undefined) process.env.DB_CONNECTION_PASSWORD_SECRET = strOld;
    else delete process.env.DB_CONNECTION_PASSWORD_SECRET;
  });

  it('비밀키 없으면 ForDisk는 평문 유지', () => {
    delete process.env.DB_CONNECTION_PASSWORD_SECRET;
    expect(fnIsDbConnPasswordSecretConfigured()).toBe(false);
    expect(fnEncryptDbConnPasswordForDisk('plain')).toBe('plain');
  });

  it('AES-256-GCM 라운드트립', () => {
    process.env.DB_CONNECTION_PASSWORD_SECRET = 'test-secret-key-16+';
    expect(fnIsDbConnPasswordSecretConfigured()).toBe(true);
    const strPlain = 'my-db-password-한글';
    const strEnc = fnEncryptDbConnPasswordPlain(strPlain);
    expect(strEnc.startsWith('enc:v1:')).toBe(true);
    expect(fnDecryptDbConnPasswordIfNeeded(strEnc)).toBe(strPlain);
    expect(fnEncryptDbConnPasswordForDisk(strPlain).startsWith('enc:v1:')).toBe(true);
  });
});
