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
import { Controller, Post, Get, Body, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
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

  /**
   * POST /api/auth/forgot-password
   * Recibe un email y envía el link de recuperación. Siempre responde 200
   * para no revelar si el email existe en el sistema.
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body('email') email: string) {
    if (!email) throw new BadRequestException('El email es requerido');
    await this.authService.forgotPassword(email);
    return { message: 'Si el email existe, recibirás un link para restablecer tu contraseña' };
  }

  /**
   * POST /api/auth/reset-password
   * Recibe el token del email y la nueva contraseña.
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body('token')       token:       string,
    @Body('newPassword') newPassword: string,
  ) {
    if (!token || !newPassword) throw new BadRequestException('Token y contraseña son requeridos');
    await this.authService.resetPassword(token, newPassword);
    return { message: 'Contraseña actualizada correctamente' };
  }

  /** GET /api/auth/mail-check — diagnóstico temporal, eliminar después */
  @Public()
  @Get('mail-check')
  mailCheck() {
    const pass = process.env.MAIL_PASS || '';
    return {
      host:     process.env.MAIL_HOST,
      port:     process.env.MAIL_PORT,
      user:     process.env.MAIL_USER,
      passLen:  pass.length,
      passHint: pass.substring(0, 4) + '...' + pass.substring(pass.length - 4),
      from:     process.env.MAIL_FROM,
      appUrl:   process.env.APP_URL,
    };
  }
}