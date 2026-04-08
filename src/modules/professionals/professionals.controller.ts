/**
 * professionals.controller.ts
 *
 * Endpoints superadmin:
 *   GET    /api/professionals          → Lista todos
 *   GET    /api/professionals/:id      → Detalle
 *   POST   /api/professionals          → Crear
 *   PATCH  /api/professionals/:id      → Editar
 *   POST   /api/professionals/:id/activate   → Activar suscripción
 *   POST   /api/professionals/:id/deactivate → Desactivar
 *
 * Endpoints del profesional autenticado:
 *   GET    /api/professionals/me       → Ver mi propio perfil
 *   PATCH  /api/professionals/me       → Actualizar mi propio perfil
 */
import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseIntPipe, UseInterceptors,
  UploadedFile, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProfessionalsService }   from './professionals.service';
import { NotificationsService }   from '../notifications/notifications.service';
import { StorageService }         from '../storage/storage.service';
import { CreateProfessionalDto }  from './dto/create-professional.dto';
import { UpdateProfileDto }       from './dto/update-profile.dto';
import { JwtAuthGuard }           from '../../common/guards/jwt-auth.guard';
import { RolesGuard }             from '../../common/guards/roles.guard';
import { Roles }                  from '../../common/decorators/roles.decorator';
import { Role }                   from '../../common/roles.enum';
import { CurrentUser }            from '../../common/decorators/current-user.decorator';
import { JwtPayload, getProfessionalId, getSecretaryId } from '../auth/jwt.strategy';
import { SecretariesService } from '../secretaries/secretaries.service';

// ── Endpoints superadmin ──────────────────────────────────────────────────────
@Controller('professionals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProfessionalsController {
  constructor(
    private readonly svc: ProfessionalsService,
    private readonly notificationsService: NotificationsService,
    private readonly storageService: StorageService,
    private readonly secretariesService: SecretariesService,
  ) {}

  // ── Ruta /me ANTES de /:id para que Express no la interprete como id="me" ──

  /**
   * POST /api/professionals/share-link
   * El profesional envía su link de reserva a un email.
   * Ruta sin :id para evitar conflicto con ParseIntPipe.
   */
  @Post('share-link')
  @Roles(Role.PROFESSIONAL, Role.SECRETARY)
  async shareLink(
    @CurrentUser() user: JwtPayload,
    @Body('email') email: string,
    @Query('professionalId', new ParseIntPipe({ optional: true })) profId?: number,
  ) {
    let professionalId: number;
    if ((user as any).role === 'secretary') {
      if (!profId) throw new ForbiddenException('La secretaria debe indicar professionalId');
      await this.secretariesService.assertAccess(getSecretaryId(user), profId);
      professionalId = profId;
    } else {
      professionalId = getProfessionalId(user);
    }
    const professional = await this.svc.findOne(professionalId);
    await this.notificationsService.sendShareLink({
      toEmail:          email,
      professionalName: professional.name,
      slug:             professional.slug,
    });
    return { message: 'Email enviado correctamente' };
  }

  /** Profesional autenticado ve su propio perfil */
  @Get('me')
  @Roles(Role.PROFESSIONAL)
  getMe(@CurrentUser() user: JwtPayload) {
    return this.svc.findOne(getProfessionalId(user));
  }

  /**
   * Profesional autenticado actualiza su propio perfil.
   * Usa UpdateProfileDto que excluye campos sensibles (email, password, isActive, etc.)
   */
  @Patch('me')
  @Roles(Role.PROFESSIONAL)
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.svc.update(getProfessionalId(user), dto);
  }

  /**
   * POST /api/professionals/change-password
   * El profesional cambia su propia contraseña validando la actual.
   */
  @Post('change-password')
  @Roles(Role.PROFESSIONAL)
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body('currentPassword') currentPassword: string,
    @Body('newPassword')     newPassword:     string,
  ) {
    return this.svc.changePassword(getProfessionalId(user), currentPassword, newPassword);
  }

  /**
   * POST /api/professionals/avatar
   * El profesional sube su foto de perfil.
   * Acepta multipart/form-data con campo "file" (JPG, PNG, WebP — max 2MB)
   */
  @Post('avatar')
  @Roles(Role.PROFESSIONAL)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB máximo
  }))
  async uploadAvatar(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');

    const professionalId = getProfessionalId(user);
    const professional   = await this.svc.findOne(professionalId);

    // Eliminar avatar anterior si existe
    if (professional.avatar) {
      await this.storageService.delete(professional.avatar);
    }

    // Subir nuevo avatar
    const avatarUrl = await this.storageService.upload(file.buffer, file.mimetype, 'avatars');

    // Guardar URL en el perfil
    await this.svc.updateAvatar(professionalId, avatarUrl);

    return { avatar: avatarUrl };
  }

  // ── Superadmin ────────────────────────────────────────────────────────────

  @Get()
  @Roles(Role.SUPERADMIN)
  findAll() { return this.svc.findAll(); }

  @Get(':id')
  @Roles(Role.SUPERADMIN)
  findOne(@Param('id', ParseIntPipe) id: number) { return this.svc.findOne(id); }

  @Post()
  @Roles(Role.SUPERADMIN)
  create(@Body() dto: CreateProfessionalDto) { return this.svc.create(dto); }

  @Patch(':id')
  @Roles(Role.SUPERADMIN)
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateProfessionalDto>) {
    const before     = await this.svc.findOne(id);
    const updated    = await this.svc.update(id, dto);
    const emailChanged = dto.email && dto.email !== before.email;

    if (emailChanged) {
      await this.notificationsService.sendEmailChanged({
        toEmail:  updated.email,
        name:     updated.name,
        newEmail: updated.email,
        role:     'profesional',
      });
    }

    return updated;
  }

  /**
   * POST /api/professionals/:id/resend-welcome
   * Regenera el reset token y reenvía el email de configuración de contraseña.
   */
  @Post(':id/resend-welcome')
  @Roles(Role.SUPERADMIN)
  async resendWelcome(@Param('id', ParseIntPipe) id: number) {
    return this.svc.resendWelcome(id);
  }

  @Post(':id/activate')
  @Roles(Role.SUPERADMIN)
  activate(
    @Param('id', ParseIntPipe) id: number,
    @Body('subscriptionEnd') subscriptionEnd: Date,
  ) { return this.svc.activate(id, subscriptionEnd); }

  @Post(':id/deactivate')
  @Roles(Role.SUPERADMIN)
  deactivate(@Param('id', ParseIntPipe) id: number) { return this.svc.deactivate(id); }
}