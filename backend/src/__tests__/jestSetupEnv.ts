/**
 * Jest 전역 — `setupFiles`로 테스트 파일·`loadEnv`보다 먼저 실행됨.
 * `.env`에 DATA_STORE=mysql이면 `app`만 import하는 테스트에서 부트스트랩이 없어
 * `fnLoadJson`이 []를 반환하고 로그인/API 테스트가 실패함. dotenv는 기존 키를 덮어쓰지 않음.
 * 통합 시 `JEST_DATA_STORE=mysql` 등으로 덮어쓸 수 있음(부트스트랩 포함 경로를 직접 마련할 것).
 */
if (!process.env.JEST_DATA_STORE?.trim()) {
  process.env.DATA_STORE = 'json';
}
