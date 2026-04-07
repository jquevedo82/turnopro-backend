/**
 * appointment.entity.ts — Tabla: appointments
 * Entidad central del sistema. Cada cita agendada es un registro aquí.
 * Para agregar campos: seguir el patrón estándar con migración.
 */
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Professional }     from '../professionals/professional.entity';
import { Client }           from '../clients/client.entity';
import { Service }          from '../services/service.entity';
import { AppointmentStatus } from './appointment-status.enum';

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Professional, (p) => p.appointments)
  @JoinColumn({ name: 'professional_id' })
  professional: Professional;

  @Column({ name: 'professional_id' })
  professionalId: number;

  @ManyToOne(() => Client, (c) => c.appointments)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ name: 'client_id' })
  clientId: number;

  @ManyToOne(() => Service, (s) => s.appointments)
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @Column({ name: 'service_id' })
  serviceId: number;

  // ── Tiempo ────────────────────────────────────────────────────────────────
  @Column({ type: 'date' })
  date: string; // Formato YYYY-MM-DD

  @Column({ name: 'start_time', type: 'time' })
  startTime: string; // Formato HH:mm

  @Column({ name: 'end_time', type: 'time' })
  endTime: string; // Formato HH:mm

  // ── Estado ────────────────────────────────────────────────────────────────
  @Column({ type: 'enum', enum: AppointmentStatus, default: AppointmentStatus.PENDING })
  status: AppointmentStatus;

  // Quién canceló: 'client' o 'professional'. Null si no fue cancelada.
  @Column({ name: 'cancelled_by', nullable: true })
  cancelledBy: string;

  // ── Token del cliente ─────────────────────────────────────────────────────
  // Token único de 64 chars para que el cliente gestione su cita sin loguearse
  // Se usa en los links de confirmación, cancelación y re-confirmación
  @Column({ unique: true, length: 64 })
  token: string;

  // Fecha en que el token fue usado por primera vez
  // Una vez usado, los intentos posteriores solo muestran el estado actual
  @Column({ name: 'token_used_at', nullable: true })
  tokenUsedAt: Date;

  // ── Recordatorios ─────────────────────────────────────────────────────────
  // Si el profesional ya envió el recordatorio de WhatsApp desde su panel
  @Column({ name: 'reminder_sent', default: false })
  reminderSent: boolean;

  // Cuándo se reconfirmó y quién lo hizo
  @Column({ name: 'reconfirmed_at', nullable: true })
  reconfirmedAt: Date;

  // 'client' o 'professional' dependiendo de quién reconfirmó
  @Column({ name: 'reconfirmed_by', nullable: true })
  reconfirmedBy: string;

  // ── Sala de espera ────────────────────────────────────────────────────────
  // Timestamp de cuando el paciente fue marcado como llegado (ARRIVED)
  @Column({ name: 'arrived_at', type: 'datetime', nullable: true })
  arrivedAt: Date;

  // ── Notas ────────────────────────────────────────────────────────────────
  @Column({ type: 'text', nullable: true })
  notes: string; // Nota opcional del cliente al reservar

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
