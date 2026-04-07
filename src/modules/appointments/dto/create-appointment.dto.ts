/**
 * create-appointment.dto.ts
 * Para agregar campos al formulario de reserva del cliente:
 *   1. Agregar aquí con validaciones
 *   2. Agregar en appointment.entity.ts
 *   3. Actualizar appointments.service.ts → create()
 */
import { IsNumber, IsString, IsOptional, IsEmail, MaxLength } from 'class-validator';
import { IsPhoneAR_VE } from '../../../common/validators/phone.validator';

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
  @MaxLength(100)
  clientName: string;
  @IsEmail({}, { message: 'El email del cliente no es válido' })
  clientEmail: string;
  @IsPhoneAR_VE()
  clientPhone: string;
  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}
