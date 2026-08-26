import { IsNumber, IsString, IsBoolean, IsOptional, Min, Max, Matches } from 'class-validator';

// HH:mm, 00-23 : 00-59 — evita valores como "25:99" que rompían el algoritmo de slots
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIME_MESSAGE = 'Formato de hora inválido, debe ser HH:mm (ej: 09:30)';

export class CreateScheduleDto {
  @IsNumber() @Min(0) @Max(6)
  dayOfWeek: number;
  @IsString() @Matches(TIME_REGEX, { message: TIME_MESSAGE })
  startTime: string;
  @IsString() @Matches(TIME_REGEX, { message: TIME_MESSAGE })
  endTime: string;
  @IsBoolean() @IsOptional()
  isActive?: boolean;
}
export class CreateExceptionDto {
  @IsString()
  date: string; // YYYY-MM-DD
  @IsBoolean() @IsOptional()
  isClosed?: boolean;
  @IsString() @IsOptional() @Matches(TIME_REGEX, { message: TIME_MESSAGE })
  customStartTime?: string;
  @IsString() @IsOptional() @Matches(TIME_REGEX, { message: TIME_MESSAGE })
  customEndTime?: string;
  @IsString() @IsOptional()
  reason?: string;
}
