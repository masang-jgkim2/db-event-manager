-- =============================================================================
-- LIVE 메타 DB 초기화 (서버 중지 후 실행)
-- =============================================================================
-- 목표:
--   역할·권한 : 아래 3·4절 INSERT (QA rolePermissions.json 기준, repo에 직접 기록)
--   사용자     : admin / admin123 만
--   프로덕트   : QA 9개 + product_service 13건
--   DB 접속    : 5절 INSERT (QA merge — 아래 npm run merge-qa-db-connection-into-reset)
--
-- 절차:
--   1. sudo systemctl stop dqpm-backend
--   2. shared/data 백업
--   3. DB 접속 5절 — QA db_connection 6건 (enc:v1, LIVE DB_CONNECTION_PASSWORD_SECRET = QA와 동일)
--   4. mysql 실행:
--        mysql -h HOST -u USER -p DATABASE < live_meta_reset.sql
--   5. MySQL → shared/data JSON 동기화 (백엔드 기동 전 필수):
--      5a. (배포 반영 후) cd .../current/backend && npm run sync-meta-json-from-mysql
--      5b. (npm 스크립트 없을 때 — 구 배포본) 아래 중 하나:
--          · shared/backend.env 에 DATA_MYSQL_SKIP_JSON_RECONCILE=1 추가
--          · bash .../current/scripts/install-live-meta-json-seed.sh
--            (products·dbConnections nServiceId 1~13 — users/roles는 MySQL만 신뢰)
--   6. sudo systemctl start dqpm-backend → admin / admin123 확인
--      (5a 완료 시 DATA_MYSQL_SKIP_JSON_RECONCILE 불필요)
--
-- 주의:
--   - DB_CONNECTION_PASSWORD_SECRET: QA db_connection 복사 시 LIVE에 QA와 동일 시크릿 필요
--   - 게임 DB(MSSQL/MySQL 실행 대상)는 이 스크립트와 무관
-- =============================================================================

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- ▼ LIVE 메타 DB명으로 변경
-- USE `dqpm`;

-- -----------------------------------------------------------------------------
-- 1) 기존 데이터 비우기
--    TRUNCATE 불가: InnoDB FK 참조 테이블은 ERROR 1701 (FK_CHECKS=0 이어도 TRUNCATE 차단)
--    → DELETE + FOREIGN_KEY_CHECKS=0 (mysqlRelationalSync 삭제 순서와 동일)
--
-- [A] 아래 INSERT 없음 → 목표는 "빈 테이블"
-- [B] 아래 INSERT 있음 → 시드 재적재 전 비우기
-- [C] db_connection → live_meta_db_connection.sql
-- -----------------------------------------------------------------------------
DELETE FROM `notification_subscription`;   -- [A]
DELETE FROM `user_notification`;           -- [A]
DELETE FROM `event_instance_stage_actor`;  -- [A]
DELETE FROM `event_instance_status_log`;   -- [A]
DELETE FROM `event_instance_execution_target`; -- [A]
DELETE FROM `event_instance_deploy_scope`; -- [A]
DELETE FROM `event_instance`;              -- [A]
DELETE FROM `event_template_query_set`;  -- [A]
DELETE FROM `event_template`;              -- [A]
DELETE FROM `activity_log`;                -- [A]
DELETE FROM `user_ui_preference`;          -- [A]
DELETE FROM `user_roles`;                  -- [B]
DELETE FROM `role_permissions`;            -- [B]
DELETE FROM `roles`;                       -- [B]
DELETE FROM `users`;                       -- [B]
DELETE FROM `db_connection`;               -- [C]
DELETE FROM `product_service`;             -- [B]
DELETE FROM `product`;                     -- [B]

-- -----------------------------------------------------------------------------
-- 1b) AUTO_INCREMENT 리셋 — AUTO_INCREMENT PK 컬럼이 있는 테이블만 (DELETE 후·INSERT 전)
--     복합 PK·앱이 n_id 직접 부여(JSON nId) 테이블은 해당 없음 → ALTER 불가/불필요
-- -----------------------------------------------------------------------------
ALTER TABLE `notification_subscription` AUTO_INCREMENT = 1;
ALTER TABLE `user_notification` AUTO_INCREMENT = 1;
ALTER TABLE `event_instance_execution_target` AUTO_INCREMENT = 1;
ALTER TABLE `event_instance_status_log` AUTO_INCREMENT = 1;
ALTER TABLE `event_template_query_set` AUTO_INCREMENT = 1;
ALTER TABLE `product_service` AUTO_INCREMENT = 1;

-- AUTO_INCREMENT 없음 (ALTER TABLE … AUTO_INCREMENT = 1 불가·무의미):
--   product, users, roles, db_connection, event_template, event_instance, activity_log
--   user_roles, role_permissions, user_ui_preference
--   event_instance_deploy_scope, event_instance_stage_actor

-- -----------------------------------------------------------------------------
-- 2) 프로덕트 9건 + 서비스 13건 (QA / live_product*.sql 와 동일)
-- -----------------------------------------------------------------------------
INSERT INTO `product` (`n_id`, `str_name`, `str_description`, `str_db_type`, `dt_created_at`, `dt_updated_at`) VALUES
	(1, '출조낚시왕', '낚시 게임', 'mssql', '2026-05-22 18:16:54.944000', '2026-05-22 18:16:54.944000'),
	(2, 'DK온라인', 'MMORPG', 'mssql', '2026-05-22 18:16:54.944000', '2026-05-22 18:16:54.944000'),
	(3, '콜오브카오스', '전략 게임', 'mssql', '2026-05-22 18:16:54.944000', '2026-05-22 18:16:54.944000'),
	(4, '아스다글로벌', 'MMORPG', 'mssql', '2026-05-22 18:16:54.944000', '2026-05-22 18:16:54.944000'),
	(5, '에이스온라인', '비행 슈팅 MMORPG', 'mssql', '2026-05-22 18:16:54.944000', '2026-05-22 18:16:54.944000'),
	(6, '라그하임', 'MMORPG', 'mysql', '2026-05-22 18:16:54.944000', '2026-05-22 18:16:54.944000'),
	(7, '스키드러시', '레이싱 게임', 'mssql', '2026-05-22 18:16:54.944000', '2026-05-22 18:16:54.944000'),
	(8, '건즈온라인', '', 'mysql', '2026-06-18 12:06:43.068000', '2026-06-18 12:06:43.068000'),
	(9, '마이크로볼츠', '', 'mysql', '2026-06-18 12:07:09.934000', '2026-06-18 12:07:09.934000');

INSERT INTO `product_service` (`n_id`, `n_product_id`, `n_sort`, `str_abbr`, `str_region`) VALUES
	(1, 1, 0, 'FH', '국내'),
	(2, 2, 0, 'DK/KR', '국내'),
	(3, 2, 1, 'DK/G', '스팀'),
	(4, 3, 0, 'CC', '국내'),
	(5, 4, 0, 'AD/G', '글로벌'),
	(6, 5, 0, 'AO/KR', '국내'),
	(7, 5, 1, 'AO/EU', '유럽'),
	(8, 5, 2, 'AO/JP', '일본'),
	(9, 6, 0, 'LH', '국내'),
	(10, 7, 0, 'SR', '국내'),
	(11, 8, 0, 'GZ/KR', '국내'),
	(12, 8, 1, 'GZ/G', '스팀'),
	(13, 9, 0, 'MV/G', '스팀');

ALTER TABLE `product_service` AUTO_INCREMENT = 14;

-- -----------------------------------------------------------------------------
-- 3) 역할 (QA rolePermissions.json / live_meta_roles_permissions.sql 과 동기)
--    권한 변경 시: cd backend && npx tsx src/scripts/generateLiveMetaRolesPermissionsSql.ts
-- -----------------------------------------------------------------------------
INSERT INTO `roles` (`n_id`, `str_code`, `str_display_name`, `str_description`, `b_is_system`, `dt_created_at`, `dt_updated_at`) VALUES
	(1, 'admin', '관리자', '전체 시스템 관리 권한', 1, '2026-05-22 18:16:54.944000', '2026-05-22 18:16:54.944000'),
	(2, 'dba', 'DBA', 'DB 쿼리 실행 전담', 1, '2026-05-22 18:16:54.944000', '2026-05-22 18:16:54.944000'),
	(3, 'game_manager', 'GM', '게임 운영 관리자', 1, '2026-05-22 18:16:54.944000', '2026-05-22 18:16:54.944000'),
	(4, 'game_designer', '기획자', '이벤트 기획 및 생성', 1, '2026-05-22 18:16:54.944000', '2026-05-22 18:16:54.944000'),
	(5, 'operator', '운영', 'QA 커스텀 역할(n_id=5)', 0, '2026-05-22 18:16:54.944000', '2026-05-22 18:16:54.944000'),
	(6, 'guest', '승인 대기(GUEST)', '가입 시 부여(로그인은 승인 후)', 1, '2026-05-22 18:16:54.944000', '2026-05-22 18:16:54.944000'),
	(7, 'viewer', '열람', 'QA 커스텀 역할(n_id=7)', 0, '2026-05-22 18:16:54.944000', '2026-05-22 18:16:54.944000');

-- -----------------------------------------------------------------------------
-- 4) 역할별 권한
-- -----------------------------------------------------------------------------
INSERT INTO `role_permissions` (`n_role_id`, `str_permission`) VALUES
	(4, 'product.view'),
	(4, 'event_template.view'),
	(4, 'my_dashboard.view'),
	(4, 'instance.view'),
	(4, 'instance.create'),
	(4, 'event_template.create'),
	(4, 'my_dashboard.detail'),
	(4, 'my_dashboard.edit'),
	(4, 'my_dashboard.request_confirm'),
	(4, 'my_dashboard.request_qa'),
	(4, 'my_dashboard.verify_qa'),
	(4, 'my_dashboard.request_qa_rereq'),
	(4, 'my_dashboard.verify_live'),
	(4, 'my_dashboard.request_live_rereq'),
	(4, 'my_dashboard.hide'),
	(4, 'my_dashboard.request_live'),
	(1, 'product.view'),
	(1, 'event_template.view'),
	(1, 'instance.create'),
	(1, 'product.create'),
	(1, 'product.edit'),
	(1, 'product.delete'),
	(1, 'event_template.create'),
	(1, 'event_template.edit'),
	(1, 'event_template.delete'),
	(1, 'user.view'),
	(1, 'user.create'),
	(1, 'user.edit'),
	(1, 'user.delete'),
	(1, 'user.reset_password'),
	(1, 'db_connection.view'),
	(1, 'db_connection.create'),
	(1, 'db_connection.edit'),
	(1, 'db_connection.delete'),
	(1, 'db_connection.test'),
	(1, 'my_dashboard.edit'),
	(1, 'my_dashboard.request_confirm'),
	(1, 'my_dashboard.request_qa'),
	(1, 'my_dashboard.request_qa_rereq'),
	(1, 'my_dashboard.execute_qa'),
	(1, 'my_dashboard.query_edit'),
	(1, 'my_dashboard.confirm'),
	(1, 'my_dashboard.verify_qa'),
	(1, 'my_dashboard.request_live'),
	(1, 'my_dashboard.request_live_rereq'),
	(1, 'my_dashboard.execute_live'),
	(1, 'my_dashboard.verify_live'),
	(1, 'role.view'),
	(1, 'role.create'),
	(1, 'role.edit'),
	(1, 'role.delete'),
	(1, 'role.edit_permissions'),
	(1, 'my_dashboard.hide'),
	(1, 'dashboard.view'),
	(1, 'my_dashboard.view'),
	(1, 'my_dashboard.detail'),
	(1, 'instance.view'),
	(1, 'my_dashboard.delete_instance'),
	(1, 'activity.view'),
	(1, 'ui_settings.manage'),
	(5, 'dashboard.view'),
	(5, 'product.view'),
	(5, 'event_template.view'),
	(5, 'event_template.create'),
	(5, 'event_template.edit'),
	(5, 'db_connection.view'),
	(5, 'db_connection.test'),
	(5, 'user.view'),
	(5, 'role.view'),
	(5, 'activity.view'),
	(5, 'my_dashboard.view'),
	(5, 'my_dashboard.detail'),
	(5, 'my_dashboard.edit'),
	(5, 'my_dashboard.confirm'),
	(5, 'my_dashboard.query_edit'),
	(5, 'my_dashboard.execute_qa'),
	(5, 'my_dashboard.execute_live'),
	(5, 'my_dashboard.hide'),
	(5, 'instance.view'),
	(5, 'instance.create'),
	(5, 'instance.delete_own'),
	(1, 'activity.clear'),
	(6, 'my_dashboard.view'),
	(1, 'user.approve'),
	(2, 'my_dashboard.view'),
	(2, 'instance.execute_qa'),
	(2, 'instance.execute_live'),
	(2, 'my_dashboard.detail'),
	(2, 'my_dashboard.confirm'),
	(2, 'my_dashboard.execute_qa'),
	(2, 'my_dashboard.execute_live'),
	(2, 'event_template.view'),
	(2, 'event_template.confirm'),
	(3, 'my_dashboard.view'),
	(3, 'product.view'),
	(3, 'event_template.view'),
	(3, 'instance.create'),
	(3, 'my_dashboard.request_confirm'),
	(3, 'my_dashboard.request_qa'),
	(3, 'my_dashboard.request_qa_rereq'),
	(3, 'my_dashboard.verify_qa'),
	(3, 'my_dashboard.request_live'),
	(3, 'my_dashboard.request_live_rereq'),
	(3, 'my_dashboard.verify_live'),
	(3, 'my_dashboard.hide'),
	(3, 'instance.view'),
	(3, 'my_dashboard.edit'),
	(3, 'my_dashboard.detail'),
	(3, 'dashboard.view'),
	(3, 'instance.delete_own'),
	(7, 'my_dashboard.view');

-- -----------------------------------------------------------------------------
-- 5) DB 접속 정보 (QA db_connection 6건, n_id 1~6 — AUTO_INCREMENT 컬럼 없음)
--    QA 변경 시: cd backend && npm run merge-qa-db-connection-into-reset
-- @db_connection_seed_begin
INSERT INTO `db_connection` (`n_id`, `n_product_id`, `str_product_name`, `n_service_id`, `str_service_abbr`, `str_kind`, `str_env`, `str_db_type`, `str_host`, `n_port`, `str_database`, `str_user`, `str_password`, `b_is_active`, `dt_created_at`, `dt_updated_at`) VALUES
	(1, 1, '출조낚시왕', 1, 'FH', 'GAME', 'qa', 'mssql', '61.100.130.71', 11433, 'master', 'dqpm', 'enc:v1:Ch6N61k4yPYYxLDiNaUgFWkNcHmR98ihtaHQFfsCfZ6n6DEwA+c=', 1, '2026-06-19 13:47:22.526000', '2026-06-20 19:15:26.112000'),
	(2, 1, '출조낚시왕', 1, 'FH', 'GAME', 'live', 'mssql', '61.100.130.71', 11433, 'master', 'dqpm', 'enc:v1:laBxhL0FLylFtOnuPZJO0GEnG3V6hKhLALCNTVhZ8CU509MODXA=', 1, '2026-06-19 13:48:01.470000', '2026-06-20 19:15:35.632000'),
	(3, 2, 'DK온라인', 2, 'DK/KR', 'GAME', 'qa', 'mssql', '61.100.130.71', 11433, 'master', 'dqpm', 'enc:v1:hM/9KnUDks8qTHrz+S4wPz+tByatbRvaJQnATxzV6YvNar6JNZ4=', 1, '2026-06-23 14:06:36.700000', '2026-06-23 14:07:44.169000'),
	(4, 2, 'DK온라인', 2, 'DK/KR', 'GAME', 'live', 'mssql', '61.100.130.71', 11433, 'master', 'dqpm', 'enc:v1:GXU1T9rEdGGt4uaK65uDo1ndIdhpCUaSmtKjVZEuVif+BVaw4ss=', 1, '2026-06-23 14:08:11.653000', '2026-06-23 14:08:11.653000'),
	(5, 4, '아스다글로벌', 5, 'AD/G', 'GAME', 'qa', 'mssql', '18.205.215.160', 1433, 'master', 'dqpm', 'enc:v1:+K37EMhnixxgrkXImQERYCrtgHuoL2YVG+BbneThi7yYXXQ0dQk=', 1, '2026-06-24 11:03:18.646000', '2026-06-24 11:23:17.159000'),
	(6, 4, '아스다글로벌', 5, 'AD/G', 'GAME', 'live', 'mssql', '18.205.215.160', 1433, 'master', 'dqpm', 'enc:v1:FBOsCWcbJ4O43Bgd6Vqy80kHC4jaOP9n3/SbYoW8jurpAJwDeQY=', 1, '2026-06-24 11:10:38.008000', '2026-06-24 11:42:50.094000');
-- @db_connection_seed_end

-- -----------------------------------------------------------------------------
-- 6) 사용자 admin / admin123 만
--    bcrypt(admin123, cost=10) — 재생성 시: cd backend && node -e "require('bcryptjs').hash('admin123',10).then(console.log)"
-- -----------------------------------------------------------------------------
INSERT INTO `users` (`n_id`, `str_user_id`, `str_password`, `str_display_name`, `str_email`, `str_status`, `dt_created_at`) VALUES
	(1, 'admin', '$2b$10$vRb0flQtw9AuB3MaPQwwcOudGkW72ihKYYH.nrYDBiYxBdcWfeK0u', '관리자', NULL, 'active', '2026-05-22 18:16:54.944000');

INSERT INTO `user_roles` (`n_user_id`, `n_role_id`) VALUES
	(1, 1);

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;

-- 검증
-- SELECT COUNT(*) AS n_product FROM product;                    -- 9
-- SELECT COUNT(*) AS n_roles FROM roles;                        -- 7
-- SELECT COUNT(*) AS n_db_conn FROM db_connection;              -- 6
-- SELECT str_user_id FROM users;                                -- admin
