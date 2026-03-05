/**
 * roles.guard.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Guard de autorización por roles.
 * Verifica que el usuario autenticado tenga el rol requerido por @Roles().
 *
 * SIEMPRE debe usarse DESPUÉS de JwtAuthGuard:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *
 * Si el usuario no tiene el rol requerido → retorna 403 Forbidden.
 *
 * Para agregar un nuevo rol al sistema:
 *   1. Agregar el valor en src/common/roles.enum.ts
 *   2. Asignar el rol en auth.service.ts al generar el JWT
 *   3. Usar @Roles(Role.NUEVO_ROL) en los endpoints
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector }                                 from '@nestjs/core';
import { Role }                                      from '../roles.enum';
import { ROLES_KEY }                                 from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Obtiene los roles requeridos del decorador @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si el endpoint no tiene @Roles(), permite el acceso
    if (!requiredRoles) return true;

    // Obtiene el usuario del request (inyectado por JwtStrategy)
    const { user } = context.switchToHttp().getRequest();

    // Verifica que el rol del usuario esté en los roles requeridos
    return requiredRoles.some((role) => user?.role === role);
  }
}
