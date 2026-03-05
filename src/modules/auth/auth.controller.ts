/**
 * auth.controller.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo: Auth | Endpoints de autenticación
 *
 * POST /api/auth/login → Login para superadmin y profesionales
 *
 * Para agregar un endpoint de refresh token:
 *   Agregar @Post('refresh') con su lógica en auth.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto }    from './dto/login.dto';
import { Public }      from '../../common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/login
   * Login unificado para todos los tipos de usuarios.
   * No requiere autenticación previa (@Public)
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
