/**
 * secretary.entity.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo: Secretaries | Tabla: secretaries
 *
 * Representa una secretaria/recepcionista que opera en nombre de uno o varios
 * profesionales dentro de una organización.
 *
 * Características:
 *   - Tiene credenciales propias (email + password) — login independiente
 *   - Su JWT lleva role: 'secretary' + secretaryId + organizationId
 *   - Puede operar la agenda de CUALQUIER profesional de su organización
 *   - NO tiene acceso a: perfil del profesional, servicios, horarios, historial clínico
 *
 * Flujo de alta:
 *   - Solo el superadmin puede crear/desactivar secretarias
 *   - Al crear: recibe email de bienvenida con link para configurar contraseña
 *
 * Para agregar permisos granulares por profesional en el futuro:
 *   - Crear tabla secretary_professional (secretaryId, professionalId)
 *   - Por ahora: acceso a todos los profesionales de la organización
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';

@Entity('secretaries')
export class Secretary {
  @PrimaryGeneratedColumn()
  id: number;

  // ── Datos de acceso ────────────────────────────────────────────────────────
  @Column({ length: 150 })
  name: string;

  // Email único en toda la tabla — es el identificador de login
  @Column({ unique: true, length: 150 })
  email: string;

  // Contraseña hasheada con bcrypt. NUNCA guardar en texto plano
  @Column({ nullable: true })
  password: string; // Nullable hasta que la secretaria configura su contraseña

  @Column({ length: 30, nullable: true })
  phone: string;

  // ── Organización ───────────────────────────────────────────────────────────
  @ManyToOne(() => Organization, (org) => org.secretaries, { nullable: false })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id' })
  organizationId: number;

  // ── Estado ─────────────────────────────────────────────────────────────────
  // El superadmin puede desactivar una secretaria sin eliminarla.
  // Una secretaria inactiva no puede iniciar sesión.
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // ── Recuperación / configuración de contraseña ────────────────────────────
  // Mismo mecanismo que los profesionales — token temporal enviado por email
  @Column({ name: 'reset_token', length: 100, nullable: true })
  resetToken: string;

  @Column({ name: 'reset_token_expiry', type: 'datetime', nullable: true })
  resetTokenExpiry: Date;

  // ── Timestamps ─────────────────────────────────────────────────────────────
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
