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
