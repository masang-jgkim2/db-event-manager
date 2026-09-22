-- QA 메타 DB: ×1000 서비스 ID → 순번 재매핑
-- 맵: 9001→13, 9003→14, 9005→15, 10001→16
-- 실행 전: 백엔드 중지. to ID(13~16) 비어 있는지 확인.
-- 실행 후: products.json 미러 nServiceId 동일 맵(또는 MySQL→미러 동기) 후 백엔드 기동.

-- ========== 사전 확인 ==========
SELECT n_id, n_product_id, n_sort, str_abbr, str_region
FROM product_service
WHERE n_id IN (9001, 9003, 9005, 10001, 13, 14, 15, 16)
ORDER BY n_id;

SELECT n_service_id, COUNT(*) AS n_cnt
FROM db_connection
WHERE n_service_id IN (9001, 9003, 9005, 10001)
GROUP BY n_service_id;

SELECT n_service_id, COUNT(*) AS n_cnt
FROM event_instance
WHERE n_service_id IN (9001, 9003, 9005, 10001)
GROUP BY n_service_id;

-- 13~16 이 이미 있으면면 아래 UPDATE 중단
SELECT n_id FROM product_service WHERE n_id IN (13, 14, 15, 16);

-- ========== 반영 (트랜잭션) ==========
START TRANSACTION;

-- 1) 참조 먼저
UPDATE db_connection SET n_service_id = 13 WHERE n_service_id = 9001;
UPDATE db_connection SET n_service_id = 14 WHERE n_service_id = 9003;
UPDATE db_connection SET n_service_id = 15 WHERE n_service_id = 9005;
UPDATE db_connection SET n_service_id = 16 WHERE n_service_id = 10001;

UPDATE event_instance SET n_service_id = 13 WHERE n_service_id = 9001;
UPDATE event_instance SET n_service_id = 14 WHERE n_service_id = 9003;
UPDATE event_instance SET n_service_id = 15 WHERE n_service_id = 9005;
UPDATE event_instance SET n_service_id = 16 WHERE n_service_id = 10001;

-- 2) product_service PK
UPDATE product_service SET n_id = 13 WHERE n_id = 9001;
UPDATE product_service SET n_id = 14 WHERE n_id = 9003;
UPDATE product_service SET n_id = 15 WHERE n_id = 9005;
UPDATE product_service SET n_id = 16 WHERE n_id = 10001;

-- 3) AUTO_INCREMENT = MAX+1
ALTER TABLE product_service AUTO_INCREMENT = 17;

COMMIT;

-- ========== 사후 확인 ==========
SELECT n_id, n_product_id, n_sort, str_abbr FROM product_service ORDER BY n_id;
SELECT AUTO_INCREMENT
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_service';
