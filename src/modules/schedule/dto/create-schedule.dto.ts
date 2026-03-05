import { IsNumber, IsString, IsBoolean, IsOptional, Min, Max } from 'class-validator';
export class CreateScheduleDto {
  @IsNumber() @Min(0) @Max(6)
  dayOfWeek: number;
  @IsString()
  startTime: string;
  @IsString()
  endTime: string;
  @IsBoolean() @IsOptional()
  isActive?: boolean;
}
export class CreateExceptionDto {
  @IsString()
  date: string; // YYYY-MM-DD
  @IsBoolean() @IsOptional()
  isClosed?: boolean;
  @IsString() @IsOptional()
  customStartTime?: string;
  @IsString() @IsOptional()
  customEndTime?: string;
  @IsString() @IsOptional()
  reason?: string;
}
