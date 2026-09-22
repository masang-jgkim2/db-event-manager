-- LIVE 메타 DB: ×1000 서비스 ID → 순번 재매핑
-- 맵: 10001→14 (14가 비어 있을 때만)
-- 실행 전: 백엔드 중지. to ID(14) 비어 있는지 확인.
-- 실행 후: products.json 미러 nServiceId 동일 맵(또는 MySQL→미러 동기) 후 백엔드 기동.

-- ========== 사전 확인 ==========
SELECT n_id, n_product_id, n_sort, str_abbr, str_region
FROM product_service
WHERE n_id IN (10001, 14)
ORDER BY n_id;

SELECT n_service_id, COUNT(*) AS n_cnt
FROM db_connection
WHERE n_service_id = 10001
GROUP BY n_service_id;

SELECT n_service_id, COUNT(*) AS n_cnt
FROM event_instance
WHERE n_service_id = 10001
GROUP BY n_service_id;

-- 14 가 이미 있으면면 아래 UPDATE 중단
SELECT n_id FROM product_service WHERE n_id = 14;

-- ========== 반영 (트랜잭션) ==========
START TRANSACTION;

UPDATE db_connection SET n_service_id = 14 WHERE n_service_id = 10001;
UPDATE event_instance SET n_service_id = 14 WHERE n_service_id = 10001;
UPDATE product_service SET n_id = 14 WHERE n_id = 10001;

-- MAX가 14면 AI=15. 다른 MAX가 더 크면 그에 맞게 조정
ALTER TABLE product_service AUTO_INCREMENT = 15;

COMMIT;

-- ========== 사후 확인 ==========
SELECT n_id, n_product_id, n_sort, str_abbr FROM product_service ORDER BY n_id;
SELECT COALESCE(MAX(n_id), 0) + 1 AS n_suggested_ai FROM product_service;
SELECT AUTO_INCREMENT
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_service';
