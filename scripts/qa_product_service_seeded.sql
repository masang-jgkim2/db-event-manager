-- QA dqpm_qa — product_service 시드 (전역 순번 n_id 1~13, AUTO_INCREMENT=14)
-- LIVE scripts/live_product_service.sql 과 동일 ID 체계.
-- 메타 ID 정리: qa_meta_service_id_reset.sql 권장 (참조 remap + 본 파일 내용 일괄).

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

USE `dqpm_qa`;

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

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
