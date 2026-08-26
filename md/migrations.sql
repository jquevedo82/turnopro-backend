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


-- -----------------------------------------------------------------------------
-- [2026-04-05] Índices faltantes en clients y schedule_exceptions
-- Motivo: evita full table scan en búsquedas de clientes y excepciones de horario.
-- -----------------------------------------------------------------------------

-- Índice compuesto en clients (professional_id, email, name)
SET @sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'clients'
      AND INDEX_NAME   = 'IDX_client_prof_email_name'
  ),
  'SELECT ''[skip] IDX_client_prof_email_name ya existe''',
  'CREATE INDEX `IDX_client_prof_email_name`
     ON `clients` (`professional_id`, `email`, `name`)'
);
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;

-- Índice compuesto en schedule_exceptions (professional_id, date)
SET @sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'schedule_exceptions'
      AND INDEX_NAME   = 'IDX_schedule_exception_prof_date'
  ),
  'SELECT ''[skip] IDX_schedule_exception_prof_date ya existe''',
  'CREATE INDEX `IDX_schedule_exception_prof_date`
     ON `schedule_exceptions` (`professional_id`, `date`)'
);
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;


-- -----------------------------------------------------------------------------
-- [2026-07-20] Aviso de vencimiento de suscripción
-- Motivo: ProfessionalsService.sendSubscriptionExpiryWarnings() (cron diario) necesita
-- registrar si ya avisó en el ciclo actual, para no reenviar el email todos los días.
-- -----------------------------------------------------------------------------
SET @sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'professionals'
      AND COLUMN_NAME  = 'subscription_warning_sent_at'
  ),
  'SELECT ''[skip] subscription_warning_sent_at ya existe''',
  'ALTER TABLE `professionals`
     ADD COLUMN `subscription_warning_sent_at` DATETIME NULL DEFAULT NULL
     AFTER `subscription_end`'
);
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;


-- -----------------------------------------------------------------------------
-- [2026-08-26] Tabla `reviews` — módulo de reseñas
-- Motivo: reseña de un paciente/cliente sobre el profesional, atada a una cita
-- completada. Primera vez que este archivo necesita una tabla nueva en vez de una
-- columna — CREATE TABLE IF NOT EXISTS es sintaxis estándar de MySQL (a diferencia
-- de ADD COLUMN IF NOT EXISTS, que es de MariaDB, ver nota del header), así que no
-- hace falta el dance de SET @sql/PREPARE/EXECUTE que usan los bloques de columna.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `reviews` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `professional_id` INT NOT NULL,
  `appointment_id`  INT NOT NULL,
  `token`           VARCHAR(64) NOT NULL,
  `reviewer_name`   VARCHAR(150) NOT NULL,
  `rating`          TINYINT UNSIGNED NULL,
  `comment`         VARCHAR(1000) NULL,
  `status`          VARCHAR(20) NOT NULL DEFAULT 'invitado',
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `submitted_at`    DATETIME NULL,
  UNIQUE KEY `UQ_review_appointment` (`appointment_id`),
  UNIQUE KEY `UQ_review_token` (`token`),
  KEY `IDX_review_professional_status` (`professional_id`, `status`),
  CONSTRAINT `FK_review_professional` FOREIGN KEY (`professional_id`) REFERENCES `professionals`(`id`),
  CONSTRAINT `FK_review_appointment`  FOREIGN KEY (`appointment_id`)  REFERENCES `appointments`(`id`)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- [2026-08-26] status/error en notifications_log
-- Motivo: NotificationsService ya soportaba registrar fallos de envío (status='failed'
-- + detalle del error), pero ningún catch la llamaba — un email que fallaba quedaba solo
-- en el log de Render, invisible en la BD. Se agregó la llamada en cada catch; estas
-- columnas ya existían en local (creadas por synchronize en algún momento previo a que
-- existiera este archivo de migraciones) pero nunca quedaron documentadas acá, así que
-- no hay garantía de que estén en Aiven. Idempotente como el resto — seguro de re-correr.
-- -----------------------------------------------------------------------------
SET @sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'notifications_log'
      AND COLUMN_NAME  = 'status'
  ),
  'SELECT ''[skip] notifications_log.status ya existe''',
  'ALTER TABLE `notifications_log`
     ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT ''sent''
     AFTER `event`'
);
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;

SET @sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'notifications_log'
      AND COLUMN_NAME  = 'error'
  ),
  'SELECT ''[skip] notifications_log.error ya existe''',
  'ALTER TABLE `notifications_log`
     ADD COLUMN `error` TEXT NULL
     AFTER `status`'
);
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;


-- -----------------------------------------------------------------------------
-- [2026-07-20] País del profesional (soporte Argentina/Colombia/Venezuela)
-- Motivo: default del selector de país en el teléfono del PACIENTE al reservar
-- (antes siempre arrancaba en +54 sin importar dónde está el profesional).
-- -----------------------------------------------------------------------------
SET @sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'professionals'
      AND COLUMN_NAME  = 'country'
  ),
  'SELECT ''[skip] country ya existe''',
  'ALTER TABLE `professionals`
     ADD COLUMN `country` VARCHAR(5) NULL DEFAULT NULL
     AFTER `whatsapp_phone`'
);
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;
