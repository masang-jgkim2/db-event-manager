# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

DQPM (Database Query Process Manager) — internal web app that drives repeatable DEV → QA → LIVE event/query workflows for game ops. Backend is Node/Express/TS with an in-memory data store (optionally mirrored to a normalized MySQL meta DB); frontend is React 19 + Vite + Ant Design.

Most non-obvious context lives in `.cursor/skills/db-event-manager/SKILL.md` (project context), `.cursor/rules/*.mdc` (coding/backend/frontend/domain rules), and `docs/` (specs, schema, design reviews). Read these before deep work. Comments and UI strings are in Korean — keep it that way.

## Commands

Backend (`backend/`):
- `npm run dev` — tsx watch on `src/index.ts`, port `4000`
- `npm run build` / `npm start` — `tsc` then `node dist/index.js`
- `npm test` — Jest, `--runInBand` (tests touch shared in-memory state and disk)
- `npm run test:api` / `npm run test:permission` / `npm run test:mysql-meta` — filtered Jest runs
- `npm run import-json-to-mysql` — one-shot load of `backend/data/*.json` into the normalized meta MySQL (uses `bAllowStubTemplates: true`; only path that inserts template stubs)
- `npm run reset-password` / `npm run encrypt-db-connections-json` / `npm run repair-users-from-json` — operational scripts
- Single test: `npx jest --runInBand src/__tests__/<file>.test.ts -t "<name pattern>"`

Frontend (`front/`):
- `npm run dev` — Vite dev server, port `5173`, proxies `/api` → `VITE_PROXY_TARGET` (default `http://127.0.0.1:4000`)
- `npm run build` — `tsc -b && vite build`
- `npm run lint` — ESLint
- `npm run test:e2e` / `npm run test:e2e:ui` — Playwright (config at `front/playwright.config.ts`, specs in `front/e2e/`). To run with backend+frontend orchestrated: `scripts/run-e2e-with-servers.ps1`.

Local dev (Windows): `start.bat` / `stop.bat` / `kill-dev-ports.bat` at repo root. Batch files are ASCII-only on purpose (cmd UTF-8 breaks Korean). Default login `admin / admin123`.

## Architecture

### Data layer is dual-mode
The backend ships with `DATA_STORE=json` (default): all domain data lives in memory, hydrated from `backend/data/*.json` at boot (`src/data/*.ts` modules wrap `jsonStore`), saved via debounced `fnSaveJson`. Setting `DATA_STORE=mysql` keeps the same in-memory shape but mirrors writes to a normalized MySQL meta schema (`src/db/mysqlAppSchema.ts` DDL; `mysqlRelationalSync.ts` does the JSON↔table mapping; `mysqlDocPersist.ts` debounces flushes). After any CUD that needs to be durable in MySQL mode, callers must `await fnAwaitMysqlDocFlush()` before responding. The meta MySQL is separate from the **target game DBs** that queries actually run against — see `src/db/dbManager.ts` / `services/queryExecutor.ts`.

Key consequence: data modules expose Repository-style accessors; never reach into the in-memory arrays directly from controllers, and remember that JSON-mode and MySQL-mode have different code paths for some features (Web Push subscriptions, in-app notifications, user UI preferences). `docs/DATA-JSON-MAP.md` and `docs/DATA-BACKEND-MYSQL.md` are the authoritative cross-references.

### Query execution (MSSQL + MySQL dual driver)
All target-DB execution funnels through `fnExecuteQueryWithText` in `services/queryExecutor.ts`. Connection selection goes through `fnResolveExecuteConnection(nProductId, strEnv, nDbConnectionId?)` — applies the same per-set `nDbConnectionId` rule for both single- and multi-set templates, falling back to the active GAME connection if no ID. The legacy `fnFindActiveConnection` is non-deterministic and must not be used in the execute path. MySQL uses `connection.query()` (text protocol) — `execute()` (prepared) breaks `USE`/`SET SESSION` so HeidiSQL parity stays broken otherwise. MSSQL encryption follows `MSSQL_ENCRYPT` env (defaults to encrypted; legacy SQL Server needs `MSSQL_ENCRYPT=false`).

A product's `strDbType` (mssql/mysql) must match every registered DB connection's `strDbType`; `dbConnectionController` enforces this.

### Event-instance workflow
Nine-state machine: `event_created → confirm_requested → dba_confirmed → qa_requested → qa_deployed → qa_verified → live_requested → live_deployed → live_verified`. Live-only deploy scope skips QA states. Re-request transitions: `qa_verified→qa_requested`, `live_deployed|live_verified→live_requested`. Transition table in `OBJ_STATUS_TRANSITIONS_BASE`, gated by `arrDeployScope` via `fnGetTransitions`. Deploy-date guard: QA needs `dtQaDeployDate <= now` (if set), LIVE needs `dtLiveDeployDate ?? dtDeployDate <= now`; DEV is never executed directly. Failed executions keep state and append a failure row to `arrStatusLogs` with `bSuccess: false`, `strError`, `strConnectionSummary`. DBA query editing (`strGeneratedQuery` and per-set queries) is allowed only in `confirm_requested` / `qa_requested` / `live_requested`. See `.cursor/rules/domain-event-instance.mdc`.

### RBAC
Permissions are a fine-grained union (`TPermission`) defined in `backend/src/types/index.ts` — the frontend mirror in `front/src/types/index.ts` must be kept in sync (label + group). View permissions gate menu visibility and page routes (`PermissionRoute`); action permissions gate buttons + APIs. Legacy `*.manage` and old `my_dashboard.delete*` get expanded to granular permissions at login via `OBJ_EXPAND` in `data/roles.ts` (but `instance.create` does NOT auto-grant edit/confirm). After authenticating the JWT, `authMiddleware` recomputes `arrPermissions` from the role tables so role edits take effect without re-login.

### Real-time (SSE)
Two streams: event-instance changes (`useEventStream` initialized once in `MainLayout`) and user presence (`useUserPresenceStream`, gated by `user.view` / `user.manage`). After any instance change, controllers must call `fnBroadcastInstanceUpdate(objInstance)`; the second arg `false` suppresses in-app/Web Push but still emits SSE (used for DBA-only query edits where `strStatus` doesn't change, to avoid noisy notifications). In MySQL mode, `inAppNotificationNotifier` persists notifications to `user_notification` after the broadcast — in JSON mode that table doesn't exist and the frontend persists to `localStorage` only. Eligibility logic lives in `eventInstanceNotificationEligibility` (backend) and `fnShouldNotifyEventInstanceProgress` (frontend) — keep them aligned.

SSE clients connect directly to the backend port (`VITE_SSE_PORT`, default 4000) via `fnBuildSseApiUrl`, bypassing the Vite `/api` proxy to avoid buffering.

### Account-scoped UI state
Frontend persists per-user settings under `dbem:u{nUserId}:<logical-key>` (pre-login uses `dbem:guest:…`). Use `fnScopedStorageGetItem` / `SetItem` rather than `localStorage` directly. On login, `ProtectedRoute` pulls server prefs (`GET /api/auth/ui-preferences`), seeds local storage, then renders; changes are debounce-pushed via `userUiPreferencesSync`.

### Activity log
Off by default. Setting `ACTIVITY_LOG_ENABLED=1|true|on|yes` enables `fnPushActivityLog` (memory + SSE + batched disk write in JSON mode, `activity_log` table in MySQL mode). `/api/notifications` and `/api/auth/ui-preferences` are excluded from logging. Jest forces it on and writes per-push. Access requires `activity.view`; bulk delete requires `activity.clear`.

## Code conventions

- **Hungarian notation everywhere**: `str`, `n`, `b`, `arr`, `obj`, `fn`, `dt`, `set`, `map`. Apply to variables, parameters, fields, and function names. Full table in `.cursor/rules/coding-standards.mdc`.
- **Comments in Korean**, only for business rules / non-obvious intent. No "increment counter" comments.
- **Logs**: `console.log('[모듈명] 메시지 | 핵심값')` for flow; `console.error` for errors. Errors should include env / product / counts where applicable.
- **Controller response shape**: `{ bSuccess: true, ... }` on success, `{ bSuccess: false, strMessage: '한글 메시지' }` on error. Messages are Korean.
- **New buttons** use the format `"새로운 ~"` (e.g. `"새로운 프로덕트"`).
- **Frontend permission gating**: hide buttons/management columns when the permission is missing; never just disable. Backend rejects with 403 regardless.
- Prefer `unknown` / explicit types over `any`; if `as any` is unavoidable, add a one-line Korean reason comment.
- When adding a `TPermission`, update both `backend/src/types/index.ts` AND `front/src/types/index.ts` (including `OBJ_PERMISSION_LABELS` / `ARR_PERMISSION_GROUPS`), and consider role auto-expansion in `data/roles.ts`.

## Things that look wrong but are intentional

- `axios` in the frontend uses **only relative `/api/...`** paths so dev (Vite proxy) and prod (same-host) both work; the SSE path is the one exception.
- `backend/src/loadEnv.ts` loads `backend/.env` by absolute path and must be the first import in `app.ts` / `index.ts` — hoisting was breaking `ACTIVITY_LOG_ENABLED` ordering.
- Tests run with `--runInBand`. Don't parallelize them; they share JSON files and in-memory state.
- Template stubs are inserted into `event_template` **only** during `import-json-to-mysql` (`bAllowStubTemplates: true`). Regular flushes never restore stubs, so deleting a template + flushing must not be expected to round-trip via FK references.
- DBA query-only edits broadcast with `fnBroadcastInstanceUpdate(obj, false)` — this is deliberate noise suppression, not a bug.
