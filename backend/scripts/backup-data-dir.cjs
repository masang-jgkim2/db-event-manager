/**
 * 롤백용: DATA_DIR(기본 cwd/data) 전체를 타임스탬프 폴더로 복사
 * 사용: backend 디렉터리에서 node scripts/backup-data-dir.cjs
 */
const fs = require('fs');
const path = require('path');

const strDataDir = process.env.DATA_DIR
  ? path.resolve(process.cwd(), process.env.DATA_DIR)
  : path.join(process.cwd(), 'data');

if (!fs.existsSync(strDataDir)) {
  console.error('[backup-data-dir] 폴더 없음:', strDataDir);
  process.exit(1);
}

const strDest = path.join(process.cwd(), `data.backup.${Date.now()}`);
fs.cpSync(strDataDir, strDest, { recursive: true });
console.log('[backup-data-dir] 복사 완료:', strDest);
