/**
 * create-appointment.dto.ts
 * Para agregar campos al formulario de reserva del cliente:
 *   1. Agregar aquí con validaciones
 *   2. Agregar en appointment.entity.ts
 *   3. Actualizar appointments.service.ts → create()
 */
import { IsNumber, IsString, IsOptional } from 'class-validator';
export class CreateAppointmentDto {
  @IsNumber()
  professionalId: number;
  @IsNumber()
  serviceId: number;
  @IsString()
  date: string; // YYYY-MM-DD
  @IsString()
  startTime: string; // HH:mm
  // Datos del cliente
  @IsString()
  clientName: string;
  @IsString()
  clientEmail: string;
  @IsString()
  clientPhone: string;
  @IsString()
  @IsOptional()
  notes?: string;
}
