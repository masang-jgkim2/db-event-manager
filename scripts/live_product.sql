-- LIVE dqpm — product 시드 (QA scripts/qa_product.sql 와 동일 9건)
-- 최초 빈 DB 적재용. product_service는 live_product_service.sql 참고.

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- USE `dqpm`;  -- LIVE DB명에 맞게 주석 해제

CREATE TABLE IF NOT EXISTS `product` (
  `n_id` int NOT NULL COMMENT 'JSON nId',
  `str_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `str_description` text COLLATE utf8mb4_unicode_ci,
  `str_db_type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'mysql | mssql 등',
  `dt_created_at` datetime(6) NOT NULL,
  `dt_updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`n_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='products.json 루트 객체(배열 요소)';

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

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
