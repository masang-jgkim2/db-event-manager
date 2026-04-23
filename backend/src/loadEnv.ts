/**
 * 반드시 다른 `src/data/*`·`app` 보다 먼저 import 할 것(import 호이스트로 dotenv가 늦게 도는 문제 방지).
 * `process.cwd()` 가 아닌 `backend/.env` 고정 경로.
 */
import path from 'path';
import dotenv from 'dotenv';

const strEnvPath = path.resolve(__dirname, '../.env');
const objResult = dotenv.config({ path: strEnvPath });
if (objResult.error && (objResult.error as NodeJS.ErrnoException).code !== 'ENOENT') {
  console.warn('[loadEnv] .env 로드 |', strEnvPath, '|', objResult.error.message);
}
