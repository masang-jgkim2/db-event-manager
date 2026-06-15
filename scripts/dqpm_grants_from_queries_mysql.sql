-- =============================================================================
-- DQPM MySQL (lh_* 게임 DB)
-- 생성: 2026-05-20T06:20:10.143Z
-- QA/LIVE 각 MySQL 인스턴스에서 실행
-- =============================================================================

-- CREATE USER IF NOT EXISTS 'dqpm'@'%' IDENTIFIED BY '***';

-- --- lh_game_svr_acheron ---
USE `lh_game_svr_acheron`;

GRANT DELETE ON `lh_game_svr_acheron`.`t_guild_stash` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_acheron`.`t_inven00` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_acheron`.`t_inven01` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_acheron`.`t_inven02` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_acheron`.`t_inven03` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_acheron`.`t_inven04` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_acheron`.`t_inven05` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_acheron`.`t_inven06` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_acheron`.`t_inven07` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_acheron`.`t_inven08` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_acheron`.`t_inven09` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_acheron`.`t_present` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_acheron`.`t_stash00` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_acheron`.`t_stash01` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_acheron`.`t_stash02` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_acheron`.`t_stash03` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_acheron`.`t_stash04` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_acheron`.`t_stash05` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_acheron`.`t_stash06` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_acheron`.`t_stash07` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_acheron`.`t_stash08` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_acheron`.`t_stash09` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_acheron`.`t_usershopitem` TO 'dqpm'@'%';
FLUSH PRIVILEGES;

-- --- lh_game_svr_cassiopea ---
USE `lh_game_svr_cassiopea`;

GRANT DELETE ON `lh_game_svr_cassiopea`.`t_guild_stash` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_cassiopea`.`t_inven00` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_cassiopea`.`t_inven01` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_cassiopea`.`t_inven02` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_cassiopea`.`t_inven03` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_cassiopea`.`t_inven04` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_cassiopea`.`t_inven05` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_cassiopea`.`t_inven06` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_cassiopea`.`t_inven07` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_cassiopea`.`t_inven08` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_cassiopea`.`t_inven09` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_cassiopea`.`t_present` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_cassiopea`.`t_stash00` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_cassiopea`.`t_stash01` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_cassiopea`.`t_stash02` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_cassiopea`.`t_stash03` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_cassiopea`.`t_stash04` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_cassiopea`.`t_stash05` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_cassiopea`.`t_stash06` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_cassiopea`.`t_stash07` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_cassiopea`.`t_stash08` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_cassiopea`.`t_stash09` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_cassiopea`.`t_usershopitem` TO 'dqpm'@'%';
FLUSH PRIVILEGES;

-- --- lh_game_svr_galaxy ---
USE `lh_game_svr_galaxy`;

GRANT DELETE ON `lh_game_svr_galaxy`.`t_guild_stash` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_galaxy`.`t_inven00` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_galaxy`.`t_inven01` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_galaxy`.`t_inven02` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_galaxy`.`t_inven03` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_galaxy`.`t_inven04` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_galaxy`.`t_inven05` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_galaxy`.`t_inven06` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_galaxy`.`t_inven07` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_galaxy`.`t_inven08` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_galaxy`.`t_inven09` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_galaxy`.`t_present` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_galaxy`.`t_stash00` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_galaxy`.`t_stash01` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_galaxy`.`t_stash02` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_galaxy`.`t_stash03` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_galaxy`.`t_stash04` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_galaxy`.`t_stash05` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_galaxy`.`t_stash06` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_galaxy`.`t_stash07` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_galaxy`.`t_stash08` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_galaxy`.`t_stash09` TO 'dqpm'@'%';
GRANT DELETE ON `lh_game_svr_galaxy`.`t_usershopitem` TO 'dqpm'@'%';
FLUSH PRIVILEGES;

-- --- lh_web_event ---
USE `lh_web_event`;

GRANT DELETE ON `lh_web_event`.`bg_game_event_goods` TO 'dqpm'@'%';
FLUSH PRIVILEGES;
