/**
 * schedule-exception.entity.ts — Tabla: schedule_exceptions
 * Excepciones a la plantilla semanal. Tienen prioridad sobre los horarios regulares.
 * Usos: feriados (isClosed=true), horarios especiales (isClosed=false + custom times)
 */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Professional } from '../professionals/professional.entity';

@Entity('schedule_exceptions')
@Index('IDX_schedule_exception_prof_date', ['professionalId', 'date'])
export class ScheduleException {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Professional, (p) => p.exceptions)
  @JoinColumn({ name: 'professional_id' })
  professional: Professional;

  @Column({ name: 'professional_id' })
  professionalId: number;

  @Column({ type: 'date' })
  date: string; // Fecha de la excepción en formato YYYY-MM-DD

  // Si true: el día está completamente cerrado
  // Si false: el día tiene un horario especial definido por customStartTime/customEndTime
  @Column({ name: 'is_closed', default: true })
  isClosed: boolean;

  @Column({ name: 'custom_start_time', type: 'time', nullable: true })
  customStartTime: string; // Solo si isClosed=false

  @Column({ name: 'custom_end_time', type: 'time', nullable: true })
  customEndTime: string; // Solo si isClosed=false

  @Column({ length: 255, nullable: true })
  reason: string; // Ej: "Feriado nacional", "Vacaciones"
}
