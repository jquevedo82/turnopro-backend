/**
 * create-organization.dto.ts
 * Módulo: Organizations
 *
 * Antes de 2026-07-20 el módulo no tenía carpeta dto/ — el controller recibía
 * @Body() como un objeto TypeScript inline, que el ValidationPipe de Nest no valida
 * (necesita una clase real con decoradores de class-validator). Esta clase reemplaza
 * ese atajo, mismo motivo que el fix de UpdateProfessionalDto.
 */
import { IsString, IsOptional, IsEmail, Matches, MaxLength } from 'class-validator';
import { IsSupportedPhone } from '../../../common/validators/phone.validator';

export class CreateOrganizationDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'El slug solo puede contener letras minúsculas, números y guiones' })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsSupportedPhone()
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El email no es válido' })
  email?: string;
}
