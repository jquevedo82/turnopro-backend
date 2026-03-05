/**
 * public.decorator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Decorador @Public() para marcar endpoints que NO requieren autenticación JWT.
 *
 * Uso: agregar @Public() antes de @Get() o @Post() en endpoints públicos.
 * JwtAuthGuard lo detecta y permite el acceso sin token.
 *
 * TODOS los endpoints del módulo PublicModule deben usar este decorador.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
