/**
 * plan.entity.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo: Plans | Tabla: plans
 * Define los planes de suscripción disponibles en la plataforma.
 *
 * Para agregar un campo nuevo al plan:
 *   1. Agregar @Column() aquí
 *   2. Agregar al DTO en dto/create-plan.dto.ts
 *   3. Ejecutar: npm run migration:generate --name=add-campo-plan
 *   4. Ejecutar: npm run migration:run
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';
import { Professional } from '../professionals/professional.entity';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn()
  id: number;

  // Nombre del plan. Ej: "Básico", "Pro"
  // Para agregar más planes: insertar registros en la BD desde el panel superadmin
  @Column({ length: 100 })
  name: string;

  // Precio mensual del plan en la moneda local
  // Para cambiar la moneda: modificar en el frontend la forma de mostrarlo
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  // Días de duración de la suscripción (30 = mensual, 365 = anual)
  @Column({ name: 'duration_days' })
  durationDays: number;

  // Si el plan está disponible para asignar a nuevos profesionales
  // Para ocultar un plan sin borrarlo: cambiar isActive a false
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relación: un plan puede tener múltiples profesionales
  @OneToMany(() => Professional, (professional) => professional.plan)
  professionals: Professional[];
}
