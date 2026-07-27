/**
 * update-professional.dto.ts
 * Módulo: Professionals
 * Usado por PATCH /professionals/:id — el superadmin edita cualquier profesional.
 * Extiende CreateProfessionalDto con PartialType (todos los campos opcionales, mismos
 * validadores). Incluye email y slug a propósito: solo el superadmin llega a este
 * endpoint (@Roles(SUPERADMIN)), y el controller ya maneja el chequeo de duplicados
 * y el email de aviso cuando cambia el email.
 *
 * Antes de 2026-07-20 este endpoint recibía `Partial<CreateProfessionalDto>` (un tipo
 * de TypeScript, no una clase) — el ValidationPipe de Nest no valida contra tipos como
 * `Partial<T>` porque el metadato reflejado es `Object`, así que no se validaba NADA acá,
 * ni el email ni el teléfono ni nada. Esta clase reemplaza ese atajo.
 */
import { PartialType } from '@nestjs/mapped-types';
import { CreateProfessionalDto } from './create-professional.dto';

export class UpdateProfessionalDto extends PartialType(CreateProfessionalDto) {}
