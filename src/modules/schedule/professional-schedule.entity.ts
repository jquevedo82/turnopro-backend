/**
 * professional-schedule.entity.ts — Tabla: professional_schedules
 * Plantilla semanal del profesional. Define qué días y en qué horario atiende.
 * Se repite automáticamente cada semana.
 * day_of_week: 0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado
 */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Professional } from '../professionals/professional.entity';

@Entity('professional_schedules')
export class ProfessionalSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Professional, (p) => p.schedules)
  @JoinColumn({ name: 'professional_id' })
  professional: Professional;

  @Column({ name: 'professional_id' })
  professionalId: number;

  // 0=Domingo ... 6=Sábado (estándar JavaScript Date.getDay())
  @Column({ name: 'day_of_week' })
  dayOfWeek: number;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string; // Formato HH:mm — Ej: "08:00"

  @Column({ name: 'end_time', type: 'time' })
  endTime: string; // Formato HH:mm — Ej: "13:00"

  // Si el día está habilitado. Para desactivar un día: poner isActive=false
  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
