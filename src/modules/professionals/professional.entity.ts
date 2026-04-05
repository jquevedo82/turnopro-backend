/**
 * professional.entity.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo: Professionals | Tabla: professionals
 * Entidad principal del sistema. Cada registro es un profesional suscripto.
 *
 * Para AGREGAR un campo al perfil del profesional:
 *   1. Agregar @Column() aquí con su tipo y opciones
 *   2. Agregar al DTO en dto/create-professional.dto.ts
 *   3. Ejecutar: npm run migration:generate --name=add-campo-professionals
 *   4. Ejecutar: npm run migration:run
 *
 * Para QUITAR un campo: marcar como nullable o eliminarlo con migración
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToMany, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Plan }                 from '../plans/plan.entity';
import { Service }              from '../services/service.entity';
import { ProfessionalSchedule } from '../schedule/professional-schedule.entity';
import { ScheduleException }    from '../schedule/schedule-exception.entity';
import { Client }               from '../clients/client.entity';
import { Appointment }          from '../appointments/appointment.entity';
import { ProfessionalType }     from './professional-type.enum';

@Entity('professionals')
export class Professional {
  @PrimaryGeneratedColumn()
  id: number;

  // ── Datos de acceso ────────────────────────────────────────────────────────
  @Column({ length: 150 })
  name: string;

  @Column({ unique: true, length: 150 })
  email: string;

  // Contraseña hasheada con bcrypt. NUNCA guardar en texto plano
  @Column()
  password: string;

  @Column({ length: 30, nullable: true })
  phone: string;

  @Column({ name: 'whatsapp_phone', length: 30, nullable: true })
  whatsappPhone: string; // Número donde el médico recibe notificaciones WhatsApp

  // ── Perfil público ─────────────────────────────────────────────────────────
  // Todo lo que aparece en la página pública tudominio.com/:slug

  @Column({ length: 100 })
  profession: string; // Ej: "Médico Clínico", "Jardinero"

  // Identificador único en la URL. Ej: "dr-garcia" → tudominio.com/dr-garcia
  // ⚠️ NO modificar una vez asignado. Rompe los links ya compartidos.
  @Column({ unique: true, length: 100 })
  slug: string;

  @Column({ length: 255, nullable: true })
  slogan: string; // Frase corta de presentación

  @Column({ type: 'text', nullable: true })
  bio: string; // Descripción detallada

  @Column({ length: 255, nullable: true })
  address: string; // Dirección del consultorio

  @Column({ length: 150, nullable: true, name: 'public_email' })
  publicEmail: string; // Email público (puede diferir del email de login)

  @Column({ length: 255, nullable: true })
  avatar: string; // URL de la foto de perfil

  @Column({ length: 255, nullable: true })
  logo: string; // URL del logo

  @Column({ length: 100, nullable: true })
  instagram: string;

  @Column({ length: 100, nullable: true })
  facebook: string;

  // Galería de fotos guardada como JSON. Máx 6 fotos
  // Para cambiar el límite de fotos: modificar la validación en el DTO
  @Column({ type: 'json', nullable: true })
  gallery: string[];

  // ── Tipo de profesional (vertical) ────────────────────────────────────────
  // Define terminología (paciente/cliente, cita/turno/sesión) y features disponibles.
  // Lo asigna el superadmin al crear el profesional. Default: HEALTH para compatibilidad.
  @Column({
    name: 'professional_type',
    type: 'enum',
    enum: ProfessionalType,
    default: ProfessionalType.HEALTH,
  })
  professionalType: ProfessionalType;

  // ── Organización ───────────────────────────────────────────────────────────
  // Nullable: un profesional puede existir de forma completamente independiente.
  // El superadmin asigna/desvincula desde su panel.
  // Cuando es null → modo individual (comportamiento actual, sin cambios).
  // Cuando tiene valor → pertenece a una clínica/organización con secretaria.
  @Column({ name: 'organization_id', nullable: true })
  organizationId: number;

  // ── Suscripción ────────────────────────────────────────────────────────────
  @ManyToOne(() => Plan, (plan) => plan.professionals, { nullable: true })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;

  @Column({ name: 'plan_id', nullable: true })
  planId: number;

  @Column({ name: 'subscription_start', type: 'date', nullable: true })
  subscriptionStart: Date;

  @Column({ name: 'subscription_end', type: 'date', nullable: true })
  subscriptionEnd: Date;

  // Si la página pública está activa y accesible
  // Se desactiva automáticamente cuando vence la suscripción
  @Column({ name: 'is_active', default: false })
  isActive: boolean;

  // ── Configuración de citas ─────────────────────────────────────────────────
  // Para cambiar los valores por defecto del sistema: modificar los valores default aquí

  // Si las citas se confirman automáticamente (true) o requieren aprobación manual (false)
  @Column({ name: 'auto_confirm', default: true })
  autoConfirm: boolean;

  // Duración de cada turno en minutos (puede ser sobrescrita por servicio)
  @Column({ name: 'slot_duration_minutes', default: 20 })
  slotDurationMinutes: number;

  // Descanso entre turnos en minutos
  @Column({ name: 'buffer_minutes', default: 5 })
  bufferMinutes: number;

  // Horas mínimas de anticipación para reservar. Ej: 2 → no se puede reservar con menos de 2hs
  @Column({ name: 'min_advance_hours', default: 2 })
  minAdvanceHours: number;

  // Días máximos de anticipación. Ej: 30 → no se puede reservar con más de 30 días
  @Column({ name: 'max_advance_days', default: 30 })
  maxAdvanceDays: number;

  // Horas límite para que el cliente pueda cancelar. Ej: 24 → solo puede cancelar con 24hs de anticipación
  @Column({ name: 'cancellation_hours', default: 24 })
  cancellationHours: number;

  // Horas para que una cita PENDING expire si no hay acción
  @Column({ name: 'pending_expiry_hours', default: 2 })
  pendingExpiryHours: number;

  // ── Sala de espera ─────────────────────────────────────────────────────────
  // Minutos de tolerancia para considerar a un paciente como llegado a tiempo.
  // Ej: 15 → un paciente puede llegar hasta 15 min tarde y aún ser marcado ARRIVED.
  @Column({ name: 'arrival_tolerance_minutes', default: 15 })
  arrivalToleranceMinutes: number;

  // Timestamp de la última acción en la cola del día (llegada, inicio, completar).
  // La pantalla pública consulta este campo cada 30s — si cambió, recarga la cola.
  @Column({ name: 'queue_updated_at', type: 'datetime', nullable: true })
  queueUpdatedAt: Date;

  // ── Recuperación de contraseña ────────────────────────────────────────────
  @Column({ name: 'reset_token', length: 100, nullable: true })
  resetToken: string;

  @Column({ name: 'reset_token_expiry', type: 'datetime', nullable: true })
  resetTokenExpiry: Date;

  // ── Timestamps ─────────────────────────────────────────────────────────────
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ── Relaciones ─────────────────────────────────────────────────────────────
  @OneToMany(() => Service, (service) => service.professional)
  services: Service[];

  @OneToMany(() => ProfessionalSchedule, (schedule) => schedule.professional)
  schedules: ProfessionalSchedule[];

  @OneToMany(() => ScheduleException, (exception) => exception.professional)
  exceptions: ScheduleException[];

  @OneToMany(() => Client, (client) => client.professional)
  clients: Client[];

  @OneToMany(() => Appointment, (appointment) => appointment.professional)
  appointments: Appointment[];
}
