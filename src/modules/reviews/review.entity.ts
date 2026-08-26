/**
 * review.entity.ts — Tabla: reviews
 * Reseña de un paciente/cliente sobre un profesional, atada a una cita completada.
 * Acceso público solo vía token de un solo uso (nunca un formulario abierto) — evita
 * spam y reseñas falsas. `reviewerName` se toma del cliente de la cita al crear la
 * invitación, nunca lo escribe quien responde.
 */
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, Index,
} from 'typeorm';
import { Professional } from '../professionals/professional.entity';
import { Appointment }  from '../appointments/appointment.entity';

export type ReviewStatus = 'invitado' | 'pendiente' | 'publicada' | 'rechazada';

@Entity('reviews')
@Index('IDX_review_professional_status', ['professionalId', 'status'])
export class Review {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Professional)
  @JoinColumn({ name: 'professional_id' })
  professional: Professional;

  @Column({ name: 'professional_id' })
  professionalId: number;

  @ManyToOne(() => Appointment)
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment;

  // Única — una invitación de reseña por cita, no se puede pedir opinión dos veces
  @Column({ name: 'appointment_id', unique: true })
  appointmentId: number;

  @Column({ unique: true, length: 64 })
  token: string;

  @Column({ name: 'reviewer_name', length: 150 })
  reviewerName: string;

  @Column({ type: 'tinyint', unsigned: true, nullable: true })
  rating: number | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  comment: string | null;

  @Column({ length: 20, default: 'invitado' })
  status: ReviewStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'submitted_at', type: 'datetime', nullable: true })
  submittedAt: Date | null;
}
