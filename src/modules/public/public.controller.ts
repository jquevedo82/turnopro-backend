/**
 * public.controller.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo: Public
 * Todos los endpoints de este módulo son PÚBLICOS (sin JWT).
 * Son consumidos por la página pública del profesional.
 *
 * GET /api/public/:slug           → Perfil público del profesional
 * GET /api/public/:slug/services  → Servicios disponibles
 * GET /api/public/:slug/quick-confirm/:token → Confirmar cita rápida (link del prof)
 * GET /api/public/:slug/quick-reject/:token  → Rechazar cita rápida
 * GET /api/public/:slug/queue     → Cola pública de sala de espera (pantalla TV)
 * GET /api/public/:slug/queue-version → Timestamp de última actualización de cola (polling liviano)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Controller, Get, Post, Param, Query, NotFoundException } from '@nestjs/common';
import { Public }               from '../../common/decorators/public.decorator';
import { ProfessionalsService } from '../professionals/professionals.service';
import { ServicesService }      from '../services/services.service';
import { AppointmentsService }  from '../appointments/appointments.service';

@Controller('public')
export class PublicController {
  constructor(
    private readonly professionalsService: ProfessionalsService,
    private readonly servicesService:      ServicesService,
    private readonly appointmentsService:  AppointmentsService,
  ) {}

  /**
   * Retorna el perfil público del profesional por slug.
   * Solo retorna profesionales activos con suscripción vigente.
   * Usado en el header de la página pública.
   */
  @Public()
  @Get(':slug')
  async getProfile(@Param('slug') slug: string) {
    const professional = await this.professionalsService.findBySlug(slug);
    // Solo exponer campos públicos. NUNCA retornar password, subscriptionEnd, etc.
    return {
      id:         professional.id,
      name:       professional.name,
      profession: professional.profession,
      slogan:     professional.slogan,
      bio:        professional.bio,
      address:    professional.address,
      phone:      professional.phone,
      publicEmail: professional.publicEmail,
      avatar:     professional.avatar,
      logo:       professional.logo,
      instagram:  professional.instagram,
      facebook:   professional.facebook,
      gallery:    professional.gallery,
    };
  }

  /** Retorna los servicios activos del profesional para el selector de reserva */
  @Public()
  @Get(':slug/services')
  async getServices(@Param('slug') slug: string) {
    const professional = await this.professionalsService.findBySlug(slug);
    return this.servicesService.findByProfessional(professional.id);
  }

  /**
   * Confirmación rápida por link. El profesional recibe este link en su WhatsApp.
   * Al abrirlo, la cita pasa a CONFIRMED sin que tenga que loguearse.
   * Protegido por el token único de la cita.
   */
  @Public()
  @Get('quick-confirm/:token')
  async quickConfirm(@Param('token') token: string) {
    const appointment = await this.appointmentsService.findByToken(token);
    await this.appointmentsService.reconfirm(token, 'professional');
    return { success: true, message: 'Cita confirmada exitosamente' };
  }

  /** Rechazo rápido por link. El profesional rechaza sin loguearse. */
  @Public()
  @Post('quick-reject/:token')
  async quickReject(@Param('token') token: string) {
    const appointment = await this.appointmentsService.findByToken(token);
    await this.appointmentsService.cancel(appointment.id, 'professional');
    return { success: true, message: 'Cita rechazada. El slot fue liberado.' };
  }

  /**
   * Cola pública de sala de espera — consumida por la pantalla /sala/:slug.
   * Sin auth. Solo muestra pacientes ARRIVED e IN_PROGRESS, con nombre anonimizado.
   * El frontend hace polling cada 30s sobre queue-version; si cambió, llama aquí.
   */
  @Public()
  @Get(':slug/queue')
  async getPublicQueue(
    @Param('slug') slug: string,
    @Query('date') date?: string,
  ) {
    const today = date ?? new Date().toISOString().split('T')[0];
    return this.appointmentsService.getPublicQueue(slug, today);
  }

  /**
   * Polling liviano — devuelve solo el timestamp de la última acción en la cola.
   * La pantalla pública llama esto cada 30s; si queueUpdatedAt cambió → recarga la cola.
   */
  @Public()
  @Get(':slug/queue-version')
  async getQueueVersion(@Param('slug') slug: string) {
    return this.appointmentsService.getQueueVersion(slug);
  }
}
