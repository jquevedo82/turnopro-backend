/**
 * notification-log.entity.ts — Tabla: notifications_log
 * Registro de cada notificación enviada. Permite auditoría y debugging.
 */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Appointment } from '../appointments/appointment.entity';

@Entity('notifications_log')
export class NotificationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Appointment)
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment;

  @Column({ name: 'appointment_id' })
  appointmentId: number;

  // Tipo de canal: 'email' o 'whatsapp'
  @Column({ length: 20 })
  type: string;

  // Evento que disparó la notificación
  // Para agregar un nuevo tipo: ampliar los valores posibles aquí y en notifications.service.ts
  @Column({ length: 50 })
  event: string; // confirmation | reminder | cancellation | reconfirmation_request

  @Column({ length: 20, default: 'sent' })
  status: string; // 'sent' | 'failed'

  @Column({ type: 'text', nullable: true })
  error: string; // Detalle del error si status=failed

  @CreateDateColumn({ name: 'sent_at' })
  sentAt: Date;
}
