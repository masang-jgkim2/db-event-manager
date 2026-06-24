-- LIVE dqpm — product_service 시드 (전역 순번 n_id 1~13, AUTO_INCREMENT=14)
-- QA scripts/qa_product_service_seeded.sql 과 동일 ID 체계. 신규 서비스는 max+1(14…) 사용.
-- products.json 시드 시 arrServices[].nServiceId 도 1~13 으로 맞출 것.

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- USE `dqpm`;  -- LIVE DB명에 맞게 주석 해제

CREATE TABLE IF NOT EXISTS `product_service` (
  `n_id` bigint NOT NULL AUTO_INCREMENT,
  `n_product_id` int NOT NULL COMMENT 'JSON nId',
  `n_sort` int NOT NULL DEFAULT '0' COMMENT 'arrServices 순서',
  `str_abbr` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'strAbbr',
  `str_region` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'strRegion',
  PRIMARY KEY (`n_id`),
  KEY `idx_product_service_product` (`n_product_id`),
  CONSTRAINT `fk_product_service_product` FOREIGN KEY (`n_product_id`) REFERENCES `product` (`n_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='products.json arrServices[]';

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

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
