/**
 * client.entity.ts — Tabla: clients
 * Los clientes son únicos por profesional + email + nombre normalizado.
 * Esto permite que una misma familia use el mismo email para distintos pacientes.
 * Un mismo email puede tener múltiples registros si los nombres son distintos.
 */
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  JoinColumn, CreateDateColumn, Index,
} from 'typeorm';
import { Professional } from '../professionals/professional.entity';
import { Appointment }  from '../appointments/appointment.entity';

@Entity('clients')
@Index('IDX_client_prof_email_name', ['professionalId', 'email', 'name']) // ← índice de búsqueda
export class Client {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Professional, (p) => p.clients)
  @JoinColumn({ name: 'professional_id' })
  professional: Professional;

  @Column({ name: 'professional_id' })
  professionalId: number;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 150 })
  email: string;

  @Column({ length: 30, nullable: true })
  phone: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Appointment, (a) => a.client)
  appointments: Appointment[];
}