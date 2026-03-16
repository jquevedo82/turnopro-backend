/**
 * appointments.controller.ts
 * Todos los métodos que reciben professionalId usan resolveProffesionalId()
 * que funciona tanto para profesionales (toma el id del JWT) como para
 * secretarias (toma el professionalId del query param y valida acceso).
 *
 * NUEVO: endpoints de today/tomorrow/confirm/etc. aceptan Role.SECRETARY.
 * La secretaria debe pasar ?professionalId=X en cada request.
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
 * @throws ForbiddenException si la secretaria no pasa professionalId
 */
async function resolveProffesionalId(
  user:               JwtPayload,
  secretariesService: SecretariesService,
  queryProfId?:       number,
): Promise<number> {
  if ((user as any).role === 'secretary') {
    if (!queryProfId) {
      throw new ForbiddenException('La secretaria debe indicar professionalId como query param');
    }
    // Valida que la secretaria tenga acceso a ese profesional
    await secretariesService.assertAccess(getSecretaryId(user), queryProfId);
    return queryProfId;
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
    @Query('professionalId', new ParseIntPipe({ optional: true })) profId?: number,
  ) {
    const today        = date ?? new Date().toISOString().split('T')[0];
    const professionalId = await resolveProffesionalId(user, this.secretariesSvc, profId);
    return this.svc.getByProfessionalAndDate(professionalId, today);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL, Role.SECRETARY)
  @Get('tomorrow')
  async getTomorrow(
    @CurrentUser() user: JwtPayload,
    @Query('professionalId', new ParseIntPipe({ optional: true })) profId?: number,
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
    @Query('professionalId', new ParseIntPipe({ optional: true })) profId?: number,
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
    @Query('professionalId', new ParseIntPipe({ optional: true })) profId?: number,
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
    @Query('professionalId', new ParseIntPipe({ optional: true })) profId?: number,
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
    @Query('professionalId', new ParseIntPipe({ optional: true })) profId?: number,
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
    @Query('professionalId', new ParseIntPipe({ optional: true })) profId?: number,
  ) {
    const professionalId = await resolveProffesionalId(user, this.secretariesSvc, profId);
    return this.svc.cancel(id, 'professional', professionalId);
  }
}
