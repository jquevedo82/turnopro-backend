/**
 * organization.entity.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo: Organizations | Tabla: organizations
 *
 * Representa una clínica, consultorio grupal o cualquier entidad que agrupe
 * varios profesionales bajo una misma administración.
 *
 * Relaciones:
 *   - Un profesional puede pertenecer a UNA organización (o ninguna)
 *   - Una organización puede tener MUCHAS secretarias
 *   - Una organización puede tener MUCHOS profesionales
 *
 * Flujo de alta desde superadmin:
 *   1. Crear organización
 *   2. Asignar profesionales existentes (actualiza su organizationId)
 *   3. Crear secretaria vinculada a esta organización
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  Entity, PrimaryGeneratedColumn, Column,
  OneToMany,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Secretary } from '../secretaries/secretary.entity';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn()
  id: number;

  // ── Datos de la organización ───────────────────────────────────────────────
  @Column({ length: 150 })
  name: string; // Ej: "Clínica del Norte", "Consultorio García"

  // Identificador único para uso interno/futuro (multi-sede, portal propio)
  // ⚠️ NO modificar una vez asignado si se usa en URLs
  @Column({ unique: true, length: 100, nullable: true })
  slug: string;

  @Column({ length: 255, nullable: true })
  address: string;

  @Column({ length: 30, nullable: true })
  phone: string;

  @Column({ length: 150, nullable: true })
  email: string; // Email de contacto general de la organización

  // ── Estado ─────────────────────────────────────────────────────────────────
  // Desactivar una org NO afecta los logins individuales de los profesionales.
  // Solo bloquea el acceso de las secretarias vinculadas.
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // ── Timestamps ─────────────────────────────────────────────────────────────
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ── Relaciones ─────────────────────────────────────────────────────────────
  // Los profesionales se acceden desde el lado del Professional (organizationId)
  // No se define OneToMany aquí para evitar carga innecesaria en cada query.
  // Para obtener los profesionales de una org: WHERE organization_id = :id

  @OneToMany(() => Secretary, (secretary) => secretary.organization)
  secretaries: Secretary[];
}
