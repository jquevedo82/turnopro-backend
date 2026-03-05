/**
 * service.entity.ts — Tabla: services
 * Servicios que ofrece cada profesional. Aparecen en la página pública.
 * Para agregar campos: seguir el mismo patrón de professional.entity.ts
 */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn } from 'typeorm';
import { Professional } from '../professionals/professional.entity';
import { Appointment }  from '../appointments/appointment.entity';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Professional, (p) => p.services)
  @JoinColumn({ name: 'professional_id' })
  professional: Professional;

  @Column({ name: 'professional_id' })
  professionalId: number;

  @Column({ length: 150 })
  name: string; // Ej: "Consulta General"

  @Column({ type: 'text', nullable: true })
  description: string;

  // Duración en minutos. Sobrescribe slotDurationMinutes del profesional
  @Column({ name: 'duration_minutes' })
  durationMinutes: number;

  // Descanso en minutos después de este servicio. null = usa el del profesional
  @Column({ name: 'buffer_minutes', nullable: true })
  bufferMinutes: number;

  // Para ocultar un servicio sin borrarlo: cambiar a false
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Appointment, (a) => a.service)
  appointments: Appointment[];
}
