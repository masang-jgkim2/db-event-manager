-- =============================================================================
-- QA 메타 product_service ID 정리 (6422~6434 → 1~13) — 메타만, 유저·템플릿·인스턴스 유지
-- =============================================================================
-- 대상 DB: dqpm_qa @ 172.31.13.99
--
-- [사전] QA Web EC2 백엔드 중지 (PM2/CodeDeploy)
--
-- [실행] HeidiSQL — 본 파일 1회 (또는 qa_remap_n_service_id.sql → qa_product_service_seeded.sql 순)
--
-- [사후] QA EC2:
--   cd backend && npm run backfill-service-ids   (node dist/scripts/backfillServiceIds.js)
--   백엔드 재기동
--   UI: DB 접속 #1 FH, 쿼리 Step2 서비스 Select 확인
--
-- [매핑표] old n_id → new n_id | prod | abbr
--   6422→1  | 1 | FH
--   6423→2  | 2 | DK/KR
--   6424→3  | 2 | DK/G
--   6425→4  | 3 | CC
--   6426→5  | 4 | AD/G
--   6427→6  | 5 | AO/KR
--   6428→7  | 5 | AO/EU
--   6429→8  | 5 | AO/JP
--   6430→9  | 6 | LH
--   6431→10 | 7 | SR
--   6432→11 | 8 | GZ/KR
--   6433→12 | 8 | GZ/G
--   6434→13 | 9 | MV/G
-- =============================================================================

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

USE `dqpm_qa`;

START TRANSACTION;

-- 1) 참조 테이블 n_service_id
UPDATE `db_connection` SET `n_service_id` = CASE `n_service_id`
	WHEN 6422 THEN 1  WHEN 6423 THEN 2  WHEN 6424 THEN 3  WHEN 6425 THEN 4
	WHEN 6426 THEN 5  WHEN 6427 THEN 6  WHEN 6428 THEN 7  WHEN 6429 THEN 8
	WHEN 6430 THEN 9  WHEN 6431 THEN 10 WHEN 6432 THEN 11 WHEN 6433 THEN 12
	WHEN 6434 THEN 13
	ELSE `n_service_id`
END
WHERE `n_service_id` BETWEEN 6422 AND 6434;

UPDATE `event_instance` SET `n_service_id` = CASE `n_service_id`
	WHEN 6422 THEN 1  WHEN 6423 THEN 2  WHEN 6424 THEN 3  WHEN 6425 THEN 4
	WHEN 6426 THEN 5  WHEN 6427 THEN 6  WHEN 6428 THEN 7  WHEN 6429 THEN 8
	WHEN 6430 THEN 9  WHEN 6431 THEN 10 WHEN 6432 THEN 11 WHEN 6433 THEN 12
	WHEN 6434 THEN 13
	ELSE `n_service_id`
END
WHERE `n_service_id` BETWEEN 6422 AND 6434;

-- 2) product_service 재시드 (1~13)
DELETE FROM `product_service`;

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

COMMIT;

-- 3) 확인 (COMMIT 후)
-- SELECT n_id, n_product_id, str_abbr FROM product_service ORDER BY n_id;
-- SELECT n_service_id, COUNT(*) FROM db_connection WHERE n_service_id IS NOT NULL GROUP BY 1;
-- SELECT n_service_id, COUNT(*) FROM event_instance WHERE n_service_id IS NOT NULL GROUP BY 1;
-- SHOW TABLE STATUS LIKE 'product_service';  -- Auto_increment = 14

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
