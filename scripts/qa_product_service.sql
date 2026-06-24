-- --------------------------------------------------------
-- 호스트:                          172.31.13.99
-- 서버 버전:                        8.0.46-0ubuntu0.24.04.2 - (Ubuntu)
-- 서버 OS:                        Linux
-- HeidiSQL 버전:                  12.8.0.6908
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- 테이블 dqpm_qa.product_service 구조 내보내기
CREATE TABLE IF NOT EXISTS `product_service` (
  `n_id` bigint NOT NULL AUTO_INCREMENT,
  `n_product_id` int NOT NULL COMMENT 'JSON nId',
  `n_sort` int NOT NULL DEFAULT '0' COMMENT 'arrServices 순서',
  `str_abbr` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'strAbbr',
  `str_region` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'strRegion',
  PRIMARY KEY (`n_id`),
  KEY `idx_product_service_product` (`n_product_id`),
  CONSTRAINT `fk_product_service_product` FOREIGN KEY (`n_product_id`) REFERENCES `product` (`n_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6435 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='products.json arrServices[]';

-- 테이블 데이터 dqpm_qa.product_service:~13 rows (대략적) 내보내기
INSERT INTO `product_service` (`n_id`, `n_product_id`, `n_sort`, `str_abbr`, `str_region`) VALUES
	(6422, 1, 0, 'FH', '국내'),
	(6423, 2, 0, 'DK/KR', '국내'),
	(6424, 2, 1, 'DK/G', '스팀'),
	(6425, 3, 0, 'CC', '국내'),
	(6426, 4, 0, 'AD/G', '글로벌'),
	(6427, 5, 0, 'AO/KR', '국내'),
	(6428, 5, 1, 'AO/EU', '유럽'),
	(6429, 5, 2, 'AO/JP', '일본'),
	(6430, 6, 0, 'LH', '국내'),
	(6431, 7, 0, 'SR', '국내'),
	(6432, 8, 0, 'GZ/KR', '국내'),
	(6433, 8, 1, 'GZ/G', '스팀'),
	(6434, 9, 0, 'MV/G', '스팀');

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
