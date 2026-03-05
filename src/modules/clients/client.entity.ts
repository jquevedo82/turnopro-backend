/**
 * client.entity.ts — Tabla: clients
 * Los clientes son únicos por profesional (no globales).
 * Un mismo email puede tener registros en múltiples profesionales.
 */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn } from 'typeorm';
import { Professional } from '../professionals/professional.entity';
import { Appointment }  from '../appointments/appointment.entity';

@Entity('clients')
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
