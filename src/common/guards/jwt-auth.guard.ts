/**
 * jwt-auth.guard.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Guard principal de autenticación JWT.
 * Verifica que el token Bearer en el header Authorization sea válido.
 *
 * Si el endpoint tiene @Public() → permite el acceso sin token.
 * Si el token es inválido o expiró → retorna 401 Unauthorized.
 *
 * Uso en controller:
 *   @UseGuards(JwtAuthGuard)
 *   @Get('ruta-protegida')
 *
 * Para cambiar el comportamiento con tokens inválidos:
 *   Modificar el método canActivate() de esta clase.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector }                    from '@nestjs/core';
import { AuthGuard }                    from '@nestjs/passport';
import { IS_PUBLIC_KEY }                from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Verifica si el endpoint tiene el decorador @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si es público, permite el acceso sin verificar el token
    if (isPublic) return true;

    // Si no es público, delega a AuthGuard('jwt') para verificar el token
    return super.canActivate(context);
  }
}
