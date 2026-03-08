import { IsString, IsNumber, IsBoolean, IsOptional, Min, Max } from 'class-validator';

export class CreateServiceDto {
  // professionalId lo inyecta el controller desde el JWT — no viene del body del cliente
  @IsNumber()
  @IsOptional()
  professionalId?: number;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(5) @Max(480)
  durationMinutes: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  bufferMinutes?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}