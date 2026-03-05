/**
 * roles.decorator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Decorador @Roles() para proteger endpoints por rol.
 *
 * Uso en un controller:
 *   @Get()
 *   @Roles(Role.SUPERADMIN)
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   findAll() { ... }
 *
 * Para proteger un endpoint con múltiples roles:
 *   @Roles(Role.SUPERADMIN, Role.PROFESSIONAL)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { SetMetadata } from '@nestjs/common';
import { Role }        from '../roles.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
