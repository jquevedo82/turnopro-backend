/**
 * update-professional.dto.ts
 * Módulo: Professionals
 * Extiende CreateProfessionalDto con PartialType — todos los campos son opcionales.
 * Solo incluye los campos que el profesional puede editar desde su panel.
 * Los campos de suscripción y rol solo los puede cambiar el superadmin.
 */
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateProfessionalDto } from './create-professional.dto';

// OmitType excluye campos que el profesional no debe poder cambiar desde su perfil
// Para que el profesional pueda editar un campo adicional: quitarlo del Omit
export class UpdateProfessionalDto extends PartialType(
  OmitType(CreateProfessionalDto, ['email', 'slug'] as const),
) {}
