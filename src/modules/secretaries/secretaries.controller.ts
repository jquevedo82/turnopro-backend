/**
 * secretaries.controller.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo: Secretaries | Solo accesible por superadmin
 *
 * Rutas anidadas bajo /organizations/:orgId/secretaries para mantener
 * coherencia REST (una secretaria siempre pertenece a una org).
 *
 * GET    /api/organizations/:orgId/secretaries        → Lista secretarias de la org
 * POST   /api/organizations/:orgId/secretaries        → Crear secretaria
 * PATCH  /api/organizations/:orgId/secretaries/:id    → Editar secretaria
 * POST   /api/organizations/:orgId/secretaries/:id/activate   → Activar
 * POST   /api/organizations/:orgId/secretaries/:id/deactivate → Desactivar
 * POST   /api/organizations/:orgId/secretaries/:id/resend     → Reenviar credenciales
 *
 * GET    /api/secretaries/my-professionals  → Para la secretaria logueada:
 *                                             lista de profesionales de su org
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  Controller, Get, Post, Patch,
  Body, Param, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { SecretariesService }   from './secretaries.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtAuthGuard }         from '../../common/guards/jwt-auth.guard';
import { RolesGuard }           from '../../common/guards/roles.guard';
import { Roles }                from '../../common/decorators/roles.decorator';
import { Role }                 from '../../common/roles.enum';
import { CurrentUser }          from '../../common/decorators/current-user.decorator';
import { JwtPayload }           from '../auth/jwt.strategy';

// ── Endpoints para la secretaria autenticada ──────────────────────────────────
@Controller('secretaries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SecretaryMeController {
  constructor(private readonly svc: SecretariesService) {}

  /**
   * GET /api/secretaries/my-professionals
   * La secretaria obtiene la lista de profesionales de su organización.
   * Usada al cargar el panel para popular el selector "Trabajando como..."
   */
  @Get('my-professionals')
  @Roles(Role.SECRETARY)
  getMyProfessionals(@CurrentUser() user: JwtPayload) {
    return this.svc.getProfessionalsForSecretary((user as any).secretaryId);
  }
}

// ── Endpoints superadmin (anidados bajo /organizations) ───────────────────────
@Controller('organizations/:orgId/secretaries')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
export class SecretariesController {
  constructor(
    private readonly svc:           SecretariesService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * GET /api/organizations/:orgId/secretaries
   * Lista todas las secretarias de una organización.
   */
  @Get()
  findAll(@Param('orgId', ParseIntPipe) orgId: number) {
    return this.svc.findByOrg(orgId);
  }

  /**
   * POST /api/organizations/:orgId/secretaries
   * Crea una secretaria vinculada a la organización.
   * Envía email de bienvenida con link para configurar contraseña.
   * Body: { name, email, phone? }
   */
  @Post()
  async create(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Body() dto: { name: string; email: string; phone?: string },
  ) {
    const { secretary, resetToken } = await this.svc.create({
      ...dto,
      organizationId: orgId,
    });

    // Enviar email de bienvenida con link para configurar contraseña
    // Reutiliza el mismo endpoint /reset-password que usan los profesionales
    await this.notifications.sendWelcomeSecretary({
      toEmail: secretary.email,
      name:    secretary.name,
      token:   resetToken,
    });

    return secretary;
  }

  /**
   * PATCH /api/organizations/:orgId/secretaries/:id
   * Edita nombre o teléfono de una secretaria.
   * Body: { name?, phone? }
   */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<{ name: string; phone: string }>,
  ) {
    return this.svc.update(id, dto);
  }

  /**
   * POST /api/organizations/:orgId/secretaries/:id/activate
   * Activa una secretaria desactivada.
   */
  @Post(':id/activate')
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.svc.setActive(id, true);
  }

  /**
   * POST /api/organizations/:orgId/secretaries/:id/deactivate
   * Desactiva una secretaria. No la elimina.
   * La secretaria no podrá iniciar sesión hasta que se reactive.
   */
  @Post(':id/deactivate')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.svc.setActive(id, false);
  }

  /**
   * POST /api/organizations/:orgId/secretaries/:id/resend
   * Regenera el token y reenvía el email de configuración de contraseña.
   */
  @Post(':id/resend')
  async resendCredentials(@Param('id', ParseIntPipe) id: number) {
    const secretary  = await this.svc.findOne(id);
    const resetToken = await this.svc.generateResetToken(id);

    await this.notifications.sendWelcomeSecretary({
      toEmail: secretary.email,
      name:    secretary.name,
      token:   resetToken,
    });

    return { message: `Credenciales reenviadas a ${secretary.email}` };
  }
}
