import net from 'net';

const mapVersionByHostPort = new Map<string, string>();

/** TCP 핸드셰이크 1패킷에서 서버 버전 문자열 추출 (예: 8.4.8, 4.0.27-log) */
const fnProbeMysqlHandshakeVersion = (strHost: string, nPort: number): Promise<string | null> =>
  new Promise((resolve) => {
    const socket = net.connect({ host: strHost, port: nPort, timeout: 5000 });
    let buf = Buffer.alloc(0);
    const fnDone = (strVer: string | null): void => {
      socket.removeAllListeners();
      try {
        socket.destroy();
      } catch {
        /* 무시 */
      }
      resolve(strVer);
    };
    socket.on('data', (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      if (buf.length < 5) return;
      const nLen = buf.readUInt32LE(0) & 0xffffff;
      if (buf.length < nLen + 4) return;
      const nZero = buf.indexOf(0, 5);
      const strVer = buf.toString('utf8', 5, nZero > 5 ? nZero : 5 + 20).trim();
      fnDone(strVer || null);
    });
    socket.on('error', () => fnDone(null));
    socket.on('timeout', () => fnDone(null));
  });

export const fnGetMysqlServerVersionCached = async (
  strHost: string,
  nPort: number,
): Promise<string | null> => {
  const strKey = `${strHost.trim()}:${nPort}`;
  const strCached = mapVersionByHostPort.get(strKey);
  if (strCached) return strCached;
  const strVer = await fnProbeMysqlHandshakeVersion(strHost, nPort);
  if (strVer) {
    mapVersionByHostPort.set(strKey, strVer);
    console.log(`[MySQL] 서버 버전 | ${strKey} | ${strVer}`);
  }
  return strVer;
};

/** mysql2 미지원 구버전(4.x 등) — Heidi는 되고 Node mysql2는 ''@client (Using password: NO) 로 실패 */
export const fnIsLegacyMysqlServerVersion = (strVersion: string | null | undefined): boolean => {
  if (!strVersion) return false;
  const m = /^(\d+)\./.exec(strVersion);
  if (!m) return false;
  return Number(m[1]) < 5;
};

export const fnClearMysqlServerVersionCache = (): void => {
  mapVersionByHostPort.clear();
};
