/**
 * appointments.controller.ts
 * Todos los métodos que reciben professionalId usan resolveProffesionalId()
 * que funciona tanto para profesionales (toma el id del JWT) como para
 * secretarias (toma el professionalId del query param y valida acceso).
 *
 * NUEVO: endpoints de today/tomorrow/confirm/etc. aceptan Role.SECRETARY.
 * La secretaria debe pasar ?professionalId=X en cada request.
 *
 * IMPORTANTE — por qué professionalId se recibe como string, no con ParseIntPipe:
 * bug real de producción (2026-09-03) encontrado al investigar por qué "Hoy" y
 * "Pendientes" no mostraban citas del profesional. El ValidationPipe global
 * (main.ts, transform:true) coacciona CUALQUIER query param tipado ?: number
 * con `+value` ANTES de que corra un pipe de parámetro — `+undefined` da `NaN`,
 * no `undefined`. Con eso, `new ParseIntPipe({ optional: true })` nunca ve el
 * valor realmente ausente que necesita para no tirar error: recibe NaN, que no
 * es "nil" pero tampoco es numérico, y siempre lanza 400. Esto rompía TODOS los
 * endpoints de este archivo para el profesional (no para la secretaria, que
 * siempre manda un professionalId real). Fix: recibir el valor crudo como
 * string (sin pipe, así el ValidationPipe global no lo toca — su coerción solo
 * aplica a metatype Number) y convertirlo acá adentro, una sola vez.
 */
import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, ParseIntPipe, ForbiddenException,
} from '@nestjs/common';
import { AppointmentsService }  from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { JwtAuthGuard }         from '../../common/guards/jwt-auth.guard';
import { RolesGuard }           from '../../common/guards/roles.guard';
import { Roles }                from '../../common/decorators/roles.decorator';
import { Role }                 from '../../common/roles.enum';
import { Public }               from '../../common/decorators/public.decorator';
import { CurrentUser }          from '../../common/decorators/current-user.decorator';
import { JwtPayload, getProfessionalId, getSecretaryId } from '../auth/jwt.strategy';
import { SecretariesService }   from '../secretaries/secretaries.service';

/**
 * Resuelve el professionalId según el rol:
 *   - professional → lo saca del JWT (comportamiento original)
 *   - secretary    → lo saca del query param y valida que tenga acceso
 *
 * queryProfId llega como string CRUDO (ver nota arriba del archivo) — se
 * convierte a number acá adentro, en un solo lugar.
 *
 * @throws ForbiddenException si la secretaria no pasa professionalId
 */
export async function resolveProffesionalId(
  user:               JwtPayload,
  secretariesService: SecretariesService,
  queryProfId?:       string,
): Promise<number> {
  const profId = queryProfId ? Number(queryProfId) : undefined;
  if (user.role === Role.SECRETARY) {
    if (!profId) {
      throw new ForbiddenException('La secretaria debe indicar professionalId como query param');
    }
    // Valida que la secretaria tenga acceso a ese profesional
    await secretariesService.assertAccess(getSecretaryId(user), profId);
    return profId;
  }
  // Profesional: comportamiento original
  return getProfessionalId(user);
}

@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly svc:              AppointmentsService,
    private readonly secretariesSvc:   SecretariesService,
  ) {}

  // ── Endpoints públicos ────────────────────────────────────────────────────

  @Public()
  @Post()
  create(@Body() dto: CreateAppointmentDto) {
    return this.svc.create(dto);
  }

  @Public()
  @Get('token/:token')
  findByToken(@Param('token') token: string) {
    return this.svc.findByToken(token);
  }

  @Public()
  @Post('token/:token/reconfirm')
  reconfirmByClient(@Param('token') token: string) {
    return this.svc.reconfirm(token, 'client');
  }

  @Public()
  @Post('token/:token/cancel')
  async cancelByClient(@Param('token') token: string) {
    const appt = await this.svc.findByToken(token);
    return this.svc.cancel(appt.id, 'client');
  }

  // ── Endpoints del profesional y secretaria ────────────────────────────────
  // Todos aceptan Role.SECRETARY además de Role.PROFESSIONAL.
  // La secretaria pasa ?professionalId=X — el helper valida el acceso.

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL, Role.SECRETARY)
  @Get('today')
  async getToday(
    @CurrentUser() user:        JwtPayload,
    @Query('date') date?:       string,
    @Query('professionalId') profId?: string,
  ) {
    const today        = date ?? new Date().toISOString().split('T')[0];
    const professionalId = await resolveProffesionalId(user, this.secretariesSvc, profId);
    return this.svc.getByProfessionalAndDate(professionalId, today);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL, Role.SECRETARY)
  @Get('pending')
  async getPending(
    @CurrentUser() user: JwtPayload,
    @Query('professionalId') profId?: string,
  ) {
    const professionalId = await resolveProffesionalId(user, this.secretariesSvc, profId);
    return this.svc.getPendingAppointments(professionalId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL, Role.SECRETARY)
  @Get('tomorrow')
  async getTomorrow(
    @CurrentUser() user: JwtPayload,
    @Query('professionalId') profId?: string,
  ) {
    const professionalId = await resolveProffesionalId(user, this.secretariesSvc, profId);
    return this.svc.getTomorrowAppointments(professionalId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL, Role.SECRETARY)
  @Post(':id/confirm')
  async confirm(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user:           JwtPayload,
    @Query('professionalId') profId?: string,
  ) {
    const professionalId = await resolveProffesionalId(user, this.secretariesSvc, profId);
    return this.svc.confirm(id, professionalId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL, Role.SECRETARY)
  @Post(':id/complete')
  async complete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user:           JwtPayload,
    @Query('professionalId') profId?: string,
  ) {
    const professionalId = await resolveProffesionalId(user, this.secretariesSvc, profId);
    return this.svc.complete(id, professionalId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL, Role.SECRETARY)
  @Post(':id/reminder')
  async markReminder(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user:           JwtPayload,
    @Query('professionalId') profId?: string,
  ) {
    const professionalId = await resolveProffesionalId(user, this.secretariesSvc, profId);
    return this.svc.markReminderSent(id, professionalId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL, Role.SECRETARY)
  @Post(':id/resend-email')
  async resendEmail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user:           JwtPayload,
    @Query('professionalId') profId?: string,
  ) {
    const professionalId = await resolveProffesionalId(user, this.secretariesSvc, profId);
    return this.svc.resendEmailToClient(id, professionalId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL, Role.SECRETARY)
  @Post(':id/cancel')
  async cancelByProfessional(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user:           JwtPayload,
    @Query('professionalId') profId?: string,
  ) {
    const professionalId = await resolveProffesionalId(user, this.secretariesSvc, profId);
    return this.svc.cancel(id, 'professional', professionalId);
  }

  // ── Sala de espera ────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL, Role.SECRETARY)
  @Post(':id/arrived')
  async markArrived(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user:           JwtPayload,
    @Query('professionalId') profId?: string,
  ) {
    const professionalId = await resolveProffesionalId(user, this.secretariesSvc, profId);
    return this.svc.markArrived(id, professionalId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL, Role.SECRETARY)
  @Post(':id/start')
  async startConsultation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user:           JwtPayload,
    @Query('professionalId') profId?: string,
  ) {
    const professionalId = await resolveProffesionalId(user, this.secretariesSvc, profId);
    return this.svc.startConsultation(id, professionalId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  @Get('admin-stats')
  getAdminStats() {
    return this.svc.getGlobalCompletedCount();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL, Role.SECRETARY)
  @Get('stats')
  async getStats(
    @CurrentUser() user: JwtPayload,
    @Query('professionalId') profId?: string,
  ) {
    const professionalId = await resolveProffesionalId(user, this.secretariesSvc, profId);
    return this.svc.getMonthlyStats(professionalId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL, Role.SECRETARY)
  @Get('queue')
  async getQueue(
    @CurrentUser() user:        JwtPayload,
    @Query('date') date?:       string,
    @Query('professionalId') profId?: string,
  ) {
    const today          = date ?? new Date().toISOString().split('T')[0];
    const professionalId = await resolveProffesionalId(user, this.secretariesSvc, profId);
    return this.svc.getQueue(professionalId, today);
  }
}
