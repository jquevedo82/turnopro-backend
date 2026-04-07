/**
 * verticals.ts — Configuración de terminología y features por tipo de profesional.
 *
 * Para cambiar los labels de un vertical: modificar el objeto correspondiente.
 * Para agregar un vertical: agregar al enum ProfessionalType y aquí.
 */
import { ProfessionalType } from '../modules/professionals/professional-type.enum';

export interface VerticalConfig {
  clientLabel:            string;  // "Paciente" | "Cliente"
  clientLabelPlural:      string;  // "Pacientes" | "Clientes"
  appointmentLabel:       string;  // "Cita" | "Turno" | "Sesión"
  appointmentLabelPlural: string;  // "Citas" | "Turnos" | "Sesiones"
  emailGreeting:          string;  // "Estimado/a" | "Hola"
  emailSignoff:           string;  // "Saludos cordiales" | "Hasta pronto"
}

export const VERTICAL_CONFIG: Record<ProfessionalType, VerticalConfig> = {
  [ProfessionalType.HEALTH]: {
    clientLabel:            'Paciente',
    clientLabelPlural:      'Pacientes',
    appointmentLabel:       'Cita',
    appointmentLabelPlural: 'Citas',
    emailGreeting:          'Estimado/a',
    emailSignoff:           'Saludos cordiales',
  },
  [ProfessionalType.BEAUTY]: {
    clientLabel:            'Cliente',
    clientLabelPlural:      'Clientes',
    appointmentLabel:       'Turno',
    appointmentLabelPlural: 'Turnos',
    emailGreeting:          'Hola',
    emailSignoff:           'Hasta pronto',
  },
  [ProfessionalType.WELLNESS]: {
    clientLabel:            'Cliente',
    clientLabelPlural:      'Clientes',
    appointmentLabel:       'Sesión',
    appointmentLabelPlural: 'Sesiones',
    emailGreeting:          'Hola',
    emailSignoff:           'Hasta pronto',
  },
  [ProfessionalType.OTHER]: {
    clientLabel:            'Cliente',
    clientLabelPlural:      'Clientes',
    appointmentLabel:       'Turno',
    appointmentLabelPlural: 'Turnos',
    emailGreeting:          'Hola',
    emailSignoff:           'Hasta pronto',
  },
};

/**
 * Retorna la config del vertical indicado.
 * Si no se especifica tipo (profesional viejo sin tipo asignado) → HEALTH por compatibilidad.
 */
export function getVerticalConfig(type?: ProfessionalType | string): VerticalConfig {
  return VERTICAL_CONFIG[(type as ProfessionalType) ?? ProfessionalType.HEALTH]
    ?? VERTICAL_CONFIG[ProfessionalType.HEALTH];
}
