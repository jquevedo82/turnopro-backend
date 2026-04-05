/**
 * appointment-status.enum.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Estados posibles de una cita en el sistema.
 *
 * Para AGREGAR un estado nuevo:
 *   1. Agregar el valor aquí
 *   2. Actualizar la lógica en appointments.service.ts
 *   3. Actualizar las queries en availability.service.ts (qué estados bloquean slots)
 *   4. Actualizar el frontend para mostrarlo con el color/ícono correcto
 * ─────────────────────────────────────────────────────────────────────────────
 */
export enum AppointmentStatus {
  PENDING      = 'pending',      // Creada, esperando acción (confirmación manual activada)
  CONFIRMED    = 'confirmed',    // Confirmada (automática o por el profesional)
  RECONFIRMED  = 'reconfirmed',  // Reconfirmada por el cliente la noche anterior
  ARRIVED      = 'arrived',      // El paciente llegó al consultorio — está en la sala de espera
  IN_PROGRESS  = 'in_progress',  // El profesional inició la consulta — paciente en consultorio
  CANCELLED    = 'cancelled',    // Cancelada por el cliente o el profesional
  REJECTED     = 'rejected',     // Rechazada por el profesional (solo en modo manual)
  EXPIRED      = 'expired',      // Expirada: nadie actuó en el tiempo límite
  COMPLETED    = 'completed',    // Marcada como completada por el profesional tras atender
  NO_SHOW      = 'no_show',      // El cliente reconfirmó pero no se presentó
}
