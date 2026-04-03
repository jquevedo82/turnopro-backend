/**
 * professional-type.enum.ts
 * Define el tipo de actividad del profesional.
 * Determina la terminología usada en la UI y los emails.
 *
 * Para agregar un nuevo tipo:
 *   1. Agregar el valor al enum
 *   2. Agregar su config en src/config/verticals.ts
 */
export enum ProfessionalType {
  HEALTH   = 'health',    // Médico, Psicólogo, Dentista, Nutricionista
  BEAUTY   = 'beauty',    // Peluquería, Manicura, Barbería, Spa
  WELLNESS = 'wellness',  // Personal trainer, Yoga, Pilates, Masajes
  OTHER    = 'other',     // Genérico — cualquier otro caso
}
