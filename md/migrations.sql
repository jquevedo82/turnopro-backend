-- =============================================================================
-- TurnoPro — Migraciones manuales de base de datos
-- =============================================================================
-- Ejecutar en orden cronológico sobre la BD de producción (Aiven MySQL 8).
--
-- IDEMPOTENCIA: cada statement usa SET @sql / PREPARE / EXECUTE para verificar
-- information_schema antes de ejecutar. Se pueden re-ejecutar sin error.
-- Nota: IF NOT EXISTS en ADD COLUMN es sintaxis MariaDB, no MySQL — no usar.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- [2026-04-03] Fase 2 — Multi-vertical: tipo de profesional
-- Motivo: se agregó soporte para verticales (health / beauty / wellness / other).
-- Impacto: todos los profesionales existentes quedan con DEFAULT 'health'.
-- -----------------------------------------------------------------------------
SET @sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'professionals'
      AND COLUMN_NAME  = 'professional_type'
  ),
  'SELECT ''[skip] professional_type ya existe''',
  'ALTER TABLE `professionals`
     ADD COLUMN `professional_type`
       ENUM(''health'', ''beauty'', ''wellness'', ''other'')
       CHARACTER SET utf8mb4
       COLLATE utf8mb4_unicode_ci
       NOT NULL
       DEFAULT ''health''
     AFTER `organization_id`'
);
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;


-- -----------------------------------------------------------------------------
-- [2026-04-05] Fase 3 — Sala de espera
-- -----------------------------------------------------------------------------

-- 1. Nuevos valores en el ENUM status (MODIFY es idempotente en MySQL)
ALTER TABLE `appointments`
  MODIFY COLUMN `status`
    ENUM('pending','confirmed','reconfirmed','arrived','in_progress','cancelled','rejected','expired','completed','no_show')
    NOT NULL
    DEFAULT 'pending';

-- 2. Timestamp de llegada
SET @sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'appointments'
      AND COLUMN_NAME  = 'arrived_at'
  ),
  'SELECT ''[skip] arrived_at ya existe''',
  'ALTER TABLE `appointments`
     ADD COLUMN `arrived_at` DATETIME NULL DEFAULT NULL
     AFTER `reconfirmed_by`'
);
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;

-- 3. Tolerancia de llegada en minutos
SET @sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'professionals'
      AND COLUMN_NAME  = 'arrival_tolerance_minutes'
  ),
  'SELECT ''[skip] arrival_tolerance_minutes ya existe''',
  'ALTER TABLE `professionals`
     ADD COLUMN `arrival_tolerance_minutes` INT NOT NULL DEFAULT 15
     AFTER `pending_expiry_hours`'
);
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;

-- 4. Timestamp de versión de cola
SET @sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'professionals'
      AND COLUMN_NAME  = 'queue_updated_at'
  ),
  'SELECT ''[skip] queue_updated_at ya existe''',
  'ALTER TABLE `professionals`
     ADD COLUMN `queue_updated_at` DATETIME NULL DEFAULT NULL
     AFTER `arrival_tolerance_minutes`'
);
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;


-- -----------------------------------------------------------------------------
-- [2026-04-05] Índice compuesto en appointments
-- Motivo: evita full table scan en consultas de disponibilidad y cola.
-- -----------------------------------------------------------------------------
SET @sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'appointments'
      AND INDEX_NAME   = 'IDX_appointment_prof_date_status'
  ),
  'SELECT ''[skip] IDX_appointment_prof_date_status ya existe''',
  'CREATE INDEX `IDX_appointment_prof_date_status`
     ON `appointments` (`professional_id`, `date`, `status`)'
);
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;
