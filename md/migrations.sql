-- =============================================================================
-- TurnoPro — Migraciones manuales de base de datos
-- =============================================================================
-- Ejecutar en orden cronológico sobre la BD de producción (Aiven MySQL).
-- Cada bloque indica la fecha, el motivo y el SQL a ejecutar.
-- Una vez aplicado, NO volver a ejecutar (no son idempotentes salvo indicación).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- [2026-04-03] Fase 2 — Multi-vertical: tipo de profesional
-- Motivo: se agregó soporte para verticales (health / beauty / wellness / other)
--         con terminología diferenciada por tipo de profesional.
-- Impacto: todos los profesionales existentes quedan con DEFAULT 'health'.
-- -----------------------------------------------------------------------------
ALTER TABLE `professionals`
  ADD COLUMN `professional_type`
    ENUM('health', 'beauty', 'wellness', 'other')
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci
    NOT NULL
    DEFAULT 'health'
  AFTER `organization_id`;


-- -----------------------------------------------------------------------------
-- [2026-04-05] Fase 3 — Sala de espera
-- Motivo: se implementó la funcionalidad de sala de espera con estados ARRIVED
--         e IN_PROGRESS, timestamp de llegada, tolerancia de llegada y versión
--         de cola para polling liviano desde la pantalla pública.
-- -----------------------------------------------------------------------------

-- 1. Nuevo estado en la columna `status` de appointments
--    Nota: MySQL requiere redefinir el ENUM completo al agregar valores.
ALTER TABLE `appointments`
  MODIFY COLUMN `status`
    ENUM('pending','confirmed','reconfirmed','arrived','in_progress','cancelled','rejected','expired','completed','no_show')
    NOT NULL
    DEFAULT 'pending';

-- 2. Timestamp de llegada del paciente a la sala
ALTER TABLE `appointments`
  ADD COLUMN `arrived_at`
    DATETIME
    NULL
    DEFAULT NULL
  AFTER `reconfirmed_by`;

-- 3. Tolerancia de llegada en minutos (cuánto tarde puede llegar y aún ser marcado ARRIVED)
ALTER TABLE `professionals`
  ADD COLUMN `arrival_tolerance_minutes`
    INT
    NOT NULL
    DEFAULT 15
  AFTER `pending_expiry_hours`;

-- 4. Timestamp de la última acción en la cola (para polling liviano desde pantalla pública)
ALTER TABLE `professionals`
  ADD COLUMN `queue_updated_at`
    DATETIME
    NULL
    DEFAULT NULL
  AFTER `arrival_tolerance_minutes`;
