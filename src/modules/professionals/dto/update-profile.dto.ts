/**
 * update-profile.dto.ts
 * DTO que puede usar el profesional para actualizar su propio perfil.
 * NO incluye campos sensibles: email, password, isActive, planId, slug.
 * Para agregar un campo editable: agregarlo aquí con su validador.
 */
import { IsString, IsOptional, IsBoolean, IsInt, IsPositive, Min } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional() @IsString() name?:       string;
  @IsOptional() @IsString() profession?: string;
  @IsOptional() @IsString() phone?:         string;
  @IsOptional() @IsString() whatsappPhone?: string;
  @IsOptional() @IsString() slogan?:     string;
  @IsOptional() @IsString() bio?:        string;
  @IsOptional() @IsString() address?:    string;
  @IsOptional() @IsString() publicEmail?: string;
  @IsOptional() @IsString() instagram?:  string;
  @IsOptional() @IsString() facebook?:   string;
  @IsOptional() @IsString() avatar?:     string; // ← URL de la foto de perfil

  // Reglas de reserva
  @IsOptional() @IsInt() @IsPositive() slotDurationMinutes?: number;
  @IsOptional() @IsInt() @Min(0)       bufferMinutes?:       number;
  @IsOptional() @IsInt() @Min(0)       minAdvanceHours?:     number;
  @IsOptional() @IsInt() @IsPositive() maxAdvanceDays?:      number;
  @IsOptional() @IsInt() @Min(0)       cancellationHours?:   number;
  @IsOptional() @IsInt() @Min(0)       pendingExpiryHours?:  number;
  @IsOptional() @IsBoolean()           autoConfirm?:         boolean;
}