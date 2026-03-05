/**
 * create-plan.dto.ts
 * Para agregar campos al formulario de creación de plan:
 *   1. Agregar aquí con sus validaciones
 *   2. Agregar en plan.entity.ts
 *   3. Generar y ejecutar migración
 */
import { IsString, IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(1)
  durationDays: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
