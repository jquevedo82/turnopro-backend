/**
 * appointments.controller.ts
 * Todos los métodos que reciben professionalId usan getProfessionalId()
 * para convertir number|null → number de forma segura.
 */
import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { AppointmentsService }  from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { JwtAuthGuard }         from '../../common/guards/jwt-auth.guard';
import { RolesGuard }           from '../../common/guards/roles.guard';
import { Roles }                from '../../common/decorators/roles.decorator';
import { Role }                 from '../../common/roles.enum';
import { Public }               from '../../common/decorators/public.decorator';
import { CurrentUser }          from '../../common/decorators/current-user.decorator';
import { JwtPayload, getProfessionalId } from '../auth/jwt.strategy';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly svc: AppointmentsService) {}

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

  /** Cancelación por token: busca la cita primero y luego cancela por id */
  @Public()
  @Post('token/:token/cancel')
  async cancelByClient(@Param('token') token: string) {
    const appt = await this.svc.findByToken(token);
    return this.svc.cancel(appt.id, 'client');
  }

  // ── Endpoints del profesional ─────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL)
  @Get('today')
  getToday(@CurrentUser() user: JwtPayload, @Query('date') date?: string) {
    const today = date ?? new Date().toISOString().split('T')[0];
    return this.svc.getByProfessionalAndDate(getProfessionalId(user), today);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL)
  @Get('tomorrow')
  getTomorrow(@CurrentUser() user: JwtPayload) {
    return this.svc.getTomorrowAppointments(getProfessionalId(user));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL)
  @Post(':id/confirm')
  confirm(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.svc.confirm(id, getProfessionalId(user));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL)
  @Post(':id/complete')
  complete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.svc.complete(id, getProfessionalId(user));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL)
  @Post(':id/reminder')
  markReminder(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.svc.markReminderSent(id, getProfessionalId(user));
  }

  /** Reenvía el email de confirmación al paciente desde el panel del profesional */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL)
  @Post(':id/resend-email')
  resendEmail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.svc.resendEmailToClient(id, getProfessionalId(user));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL)
  @Post(':id/cancel')
  cancelByProfessional(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.svc.cancel(id, 'professional', getProfessionalId(user));
  }
}
