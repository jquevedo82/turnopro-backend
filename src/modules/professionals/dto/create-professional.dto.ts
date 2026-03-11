/**
 * create-professional.dto.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * DTO para crear un profesional desde el panel superadmin.
 *
 * Para AGREGAR un campo al formulario de alta:
 *   1. Agregar aquí con sus validaciones de class-validator
 *   2. Agregar en professional.entity.ts
 *   3. Agregar en professionals.service.ts → create()
 *   4. Generar y ejecutar migración
 *
 * Para hacer un campo OPCIONAL: agregar @IsOptional() antes del tipo
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  IsString, IsEmail, IsOptional, IsNumber,
  IsBoolean, IsDateString, MinLength, Matches, Min, Max,
} from 'class-validator';

export class CreateProfessionalDto {
  // ── Datos obligatorios ───────────────────────────────────────────────────
  @IsString()
  name: string;

  @IsEmail({}, { message: 'El email no es válido' })
  email: string;

  // Contraseña temporal — si no se envía, el sistema genera una aleatoria.
  // El profesional configura la suya desde el email de bienvenida.
  @IsString()
  @IsOptional()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password?: string;

  @IsString()
  profession: string;

  // El slug genera la URL: tudominio.com/:slug
  // Solo letras minúsculas, números y guiones
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'El slug solo puede contener letras minúsculas, números y guiones' })
  slug: string;

  // ── Datos opcionales del perfil ──────────────────────────────────────────
  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  slogan?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber()
  @IsOptional()
  planId?: number;

  @IsDateString()
  @IsOptional()
  subscriptionStart?: Date;

  @IsDateString()
  @IsOptional()
  subscriptionEnd?: Date;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // ── Configuración de citas (con valores por defecto) ─────────────────────
  // Para cambiar los defaults del sistema: modificar los valores en professional.entity.ts
  @IsBoolean()
  @IsOptional()
  autoConfirm?: boolean;

  @IsNumber()
  @Min(5)
  @Max(480)
  @IsOptional()
  slotDurationMinutes?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  bufferMinutes?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minAdvanceHours?: number;

  @IsNumber()
  @Min(1)
  @Max(365)
  @IsOptional()
  maxAdvanceDays?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  cancellationHours?: number;
}