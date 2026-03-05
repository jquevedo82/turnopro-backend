/**
 * schedule.entity.ts — Módulo: Schedule
 * Plantilla semanal de atención del profesional.
 * Cada registro define un día de la semana con su horario de inicio y fin.
 * El sistema genera los slots disponibles a partir de estos registros.
 */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Professional } from '../professionals/professional.entity';

@Entity('professional_schedules')
export class ProfessionalSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Professional, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'professional_id' })
  professional: Professional;

  // dayOfWeek: 0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado
  // Para cambiar el estándar (ej: 1=Domingo): actualizar también availability.service.ts
  @Column({ type: 'int' })
  dayOfWeek: number;

  @Column({ type: 'time' })
  startTime: string; // Formato HH:MM — Ej: '08:00'

  @Column({ type: 'time' })
  endTime: string; // Formato HH:MM — Ej: '13:00'

  @Column({ default: true })
  isActive: boolean; // false = ese día no está disponible para reservas
}
