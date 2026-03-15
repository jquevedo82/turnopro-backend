/**
 * roles.enum.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Define los roles disponibles en el sistema.
 *
 * Para AGREGAR un rol nuevo:
 *   1. Agregar el valor aquí (ej: STAFF = 'staff')
 *   2. Usarlo con el decorador @Roles(Role.STAFF) en los endpoints
 *   3. Asegurarse de que el JWT incluya el nuevo rol al generarse en auth.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */
export enum Role {
  SUPERADMIN = 'superadmin',
  PROFESSIONAL = 'professional',
  SECRETARY = 'secretary',   // ← agregar esta línea
}
