/**
 * current-user.decorator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Decorador @CurrentUser() para obtener el usuario autenticado en el controller.
 *
 * Uso:
 *   @Get('profile')
 *   @UseGuards(JwtAuthGuard)
 *   getProfile(@CurrentUser() user: JwtPayload) {
 *     return user; // { sub, email, role, professionalId }
 *   }
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // Inyectado por JwtStrategy.validate()
  },
);
