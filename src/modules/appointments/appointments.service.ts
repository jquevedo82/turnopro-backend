/**
 * appointments.service.ts — Gestión del ciclo de vida de las citas.
 * findOne usa Promise<Appointment | null> correctamente con el operador de aserción.
 */
import {
  Injectable, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v4 as uuidv4 }    from 'uuid';
import { Appointment }      from './appointment.entity';
import { AppointmentStatus } from './appointment-status.enum';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ClientsService }       from '../clients/clients.service';
import { ProfessionalsService } from '../professionals/professionals.service';
import { ServicesService }      from '../services/services.service';
import { AvailabilityService }  from '../availability/availability.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly repo: Repository<Appointment>,
    private readonly clientsService:       ClientsService,
    private readonly professionalsService: ProfessionalsService,
    private readonly servicesService:      ServicesService,
    private readonly availabilityService:  AvailabilityService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateAppointmentDto): Promise<Appointment> {
    const professional = await this.professionalsService.findOne(dto.professionalId);
    const service      = await this.servicesService.findOne(dto.serviceId);

    const availableSlots = await this.availabilityService.getAvailableSlots(
      dto.professionalId, dto.date, dto.serviceId,
    );
    if (!availableSlots.includes(dto.startTime)) {
      throw new BadRequestException('El horario seleccionado ya no está disponible');
    }

    const client = await this.clientsService.findOrCreate({
      professionalId: dto.professionalId,
      name:  dto.clientName,
      email: dto.clientEmail,
      phone: dto.clientPhone,
    });

    const duration = service.durationMinutes;
    const [h, m]   = dto.startTime.split(':').map(Number);
    const endMin   = h * 60 + m + duration;
    const endTime  = `${Math.floor(endMin / 60).toString().padStart(2,'0')}:${(endMin % 60).toString().padStart(2,'0')}`;

    const status = professional.autoConfirm
      ? AppointmentStatus.CONFIRMED
      : AppointmentStatus.PENDING;

    const appointment = await this.repo.save(this.repo.create({
      professionalId: dto.professionalId,
      clientId:       client.id,
      serviceId:      dto.serviceId,
      date:           dto.date,
      startTime:      dto.startTime,
      endTime,
      status,
      notes: dto.notes,
      token: uuidv4().replace(/-/g, ''),
    }));

    await this.notificationsService.sendAppointmentConfirmation(appointment, client, professional, service);
    // Notificar al médico que llegó una nueva reserva
    await this.notificationsService.notifyProfessionalNewAppointment(appointment, client, professional, service);
    return appointment;
  }

  async confirm(id: number, professionalId: number): Promise<Appointment> {
    const appt = await this.findOneByProfessional(id, professionalId);
    // Permite confirmar desde PENDING o RECONFIRMED (el cliente confirmó antes que el médico)
    const confirmableStatuses = [AppointmentStatus.PENDING, AppointmentStatus.RECONFIRMED];
    if (!confirmableStatuses.includes(appt.status)) {
      throw new BadRequestException('Solo se pueden confirmar citas en estado PENDIENTE o RECONFIRMADA');
    }
    // Si el cliente ya reconfirmó, mantener RECONFIRMED; si no, pasar a CONFIRMED
    const newStatus = appt.status === AppointmentStatus.RECONFIRMED
      ? AppointmentStatus.RECONFIRMED
      : AppointmentStatus.CONFIRMED;
    await this.repo.update(id, { status: newStatus });
    // Notificar al paciente que su cita fue confirmada por el médico
    const confirmed = await this.repo.findOne({ where: { id }, relations: ['client', 'service'] });
    if (confirmed) {
      const prof = await this.professionalsService.findOne(professionalId);
      await this.notificationsService.notifyClientAppointmentConfirmed(confirmed, confirmed.client, prof, confirmed.service);
    }
    return this.findById(id);
  }

  async cancel(id: number, cancelledBy: 'client' | 'professional', professionalId?: number): Promise<Appointment> {
    const appt = professionalId
      ? await this.findOneByProfessional(id, professionalId)
      : await this.repo.findOne({ where: { id }, relations: ['professional'] });

    if (!appt) throw new NotFoundException('Cita no encontrada');

    const cancellableStatuses = [
      AppointmentStatus.PENDING,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.RECONFIRMED,
    ];
    if (!cancellableStatuses.includes(appt.status)) {
      throw new BadRequestException('Esta cita no puede ser cancelada');
    }

    if (cancelledBy === 'client') {
      const professional = appt.professional;
      const appointmentDateTime = new Date(`${appt.date}T${appt.startTime}`);
      const hoursUntilAppt = (appointmentDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilAppt < professional.cancellationHours) {
        throw new BadRequestException(
          `Solo podés cancelar con al menos ${professional.cancellationHours} horas de anticipación`
        );
      }
    }

    await this.repo.update(id, { status: AppointmentStatus.CANCELLED, cancelledBy });
    // Notificar al paciente que la cita fue cancelada
    const cancelled = await this.repo.findOne({ where: { id }, relations: ['client', 'service', 'professional'] });
    if (cancelled) {
      await this.notificationsService.notifyClientCancellation(cancelled, cancelled.client, cancelled.professional, cancelledBy);
    }
    return this.findById(id);
  }

  async reconfirm(token: string, by: 'client' | 'professional'): Promise<Appointment> {
    const appt = await this.repo.findOne({ where: { token } });
    if (!appt) throw new NotFoundException('Cita no encontrada');
    if (appt.status === AppointmentStatus.RECONFIRMED) return appt;
    // Permitir reconfirmar desde PENDING (autoConfirm=false) o CONFIRMED
    const reconfirmableStatuses = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED];
    if (!reconfirmableStatuses.includes(appt.status)) {
      throw new BadRequestException('La cita no puede ser reconfirmada en su estado actual');
    }
    await this.repo.update(appt.id, {
      status:        AppointmentStatus.RECONFIRMED,
      reconfirmedAt: new Date(),
      reconfirmedBy: by,
    });
    const updated = await this.repo.findOne({ where: { token }, relations: ['client', 'service', 'professional'] }) as Appointment;
    // Notificar al médico que el paciente confirmó asistencia
    if (updated && by === 'client') {
      await this.notificationsService.notifyProfessionalClientReconfirmed(updated, updated.client, updated.professional, updated.service);
    }
    return updated;
  }

  async findByToken(token: string): Promise<Appointment> {
    const appt = await this.repo.findOne({
      where: { token },
      relations: ['client', 'service', 'professional'],
    });
    if (!appt) throw new NotFoundException('Cita no encontrada');
    return appt;
  }

  getByProfessionalAndDate(professionalId: number, date: string): Promise<Appointment[]> {
    return this.repo.find({
      where: { professionalId, date },
      relations: ['client', 'service'],
      order: { startTime: 'ASC' },
    });
  }

  getTomorrowAppointments(professionalId: number): Promise<Appointment[]> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    return this.repo.find({
      where: [
        { professionalId, date: tomorrowStr, status: AppointmentStatus.CONFIRMED },
        { professionalId, date: tomorrowStr, status: AppointmentStatus.RECONFIRMED },
        { professionalId, date: tomorrowStr, status: AppointmentStatus.PENDING },
        { professionalId, date: tomorrowStr, status: AppointmentStatus.COMPLETED },
        { professionalId, date: tomorrowStr, status: AppointmentStatus.CANCELLED },
      ],
      relations: ['client', 'service'],
      order: { startTime: 'ASC' },
    });
  }

  async resendEmailToClient(id: number, professionalId: number): Promise<{ message: string }> {
    const appt = await this.repo.findOne({
      where: { id, professionalId },
      relations: ['client', 'service'],
    });
    if (!appt) throw new NotFoundException('Cita no encontrada');
    const professional = await this.professionalsService.findOne(professionalId);
    await this.notificationsService.resendConfirmationToClient(appt, appt.client, professional, appt.service);
    return { message: 'Email enviado correctamente' };
  }

  async markReminderSent(id: number, professionalId: number): Promise<Appointment> {
    await this.findOneByProfessional(id, professionalId);
    await this.repo.update(id, { reminderSent: true });
    return this.findById(id);
  }

  async complete(id: number, professionalId: number): Promise<Appointment> {
    const appt = await this.findOneByProfessional(id, professionalId);
    const completableStatuses = [
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.RECONFIRMED,
      AppointmentStatus.ARRIVED,
      AppointmentStatus.IN_PROGRESS,
    ];
    if (!completableStatuses.includes(appt.status)) {
      throw new BadRequestException('Solo se pueden completar citas confirmadas, con paciente llegado o en curso');
    }
    await this.repo.update(id, { status: AppointmentStatus.COMPLETED });
    await this.professionalsService.bumpQueueUpdatedAt(professionalId);
    // Enviar email de gracias + rebooking al paciente
    const completed = await this.repo.findOne({ where: { id }, relations: ['client'] });
    if (completed) {
      const prof = await this.professionalsService.findOne(professionalId);
      await this.notificationsService.notifyClientAppointmentCompleted(completed, completed.client, prof);
    }
    return this.findById(id);
  }

  // ── Sala de espera ────────────────────────────────────────────────────────

  /** Marca un paciente como llegado (ARRIVED). Acepta desde CONFIRMED o RECONFIRMED. */
  async markArrived(id: number, professionalId: number): Promise<Appointment> {
    const appt = await this.findOneByProfessional(id, professionalId);
    const arrivableStatuses = [AppointmentStatus.CONFIRMED, AppointmentStatus.RECONFIRMED];
    if (!arrivableStatuses.includes(appt.status)) {
      throw new BadRequestException('Solo se puede marcar como llegado desde CONFIRMADA o RECONFIRMADA');
    }
    await this.repo.update(id, {
      status:    AppointmentStatus.ARRIVED,
      arrivedAt: new Date(),
    });
    await this.professionalsService.bumpQueueUpdatedAt(professionalId);
    return this.findById(id);
  }

  /** Inicia la consulta (IN_PROGRESS). Solo desde ARRIVED. */
  async startConsultation(id: number, professionalId: number): Promise<Appointment> {
    const appt = await this.findOneByProfessional(id, professionalId);
    if (appt.status !== AppointmentStatus.ARRIVED) {
      throw new BadRequestException('Solo se puede iniciar la consulta de un paciente que ya llegó');
    }
    await this.repo.update(id, { status: AppointmentStatus.IN_PROGRESS });
    await this.professionalsService.bumpQueueUpdatedAt(professionalId);
    return this.findById(id);
  }

  /**
   * Cola del día para el panel del profesional/secretaria.
   * Incluye todos los estados activos del día, ordenados por arrivedAt (llegados primero)
   * y luego por startTime para los que aún no llegaron.
   */
  async getQueue(professionalId: number, date: string): Promise<Appointment[]> {
    return this.repo.find({
      where: [
        { professionalId, date, status: AppointmentStatus.CONFIRMED },
        { professionalId, date, status: AppointmentStatus.RECONFIRMED },
        { professionalId, date, status: AppointmentStatus.ARRIVED },
        { professionalId, date, status: AppointmentStatus.IN_PROGRESS },
        { professionalId, date, status: AppointmentStatus.COMPLETED },
      ],
      relations: ['client', 'service'],
      order: { arrivedAt: 'ASC', startTime: 'ASC' },
    });
  }

  /**
   * Cola pública para la pantalla de sala de espera /sala/:slug.
   * Solo muestra pacientes ARRIVED e IN_PROGRESS.
   * Anonimiza el nombre: "Juan García" → "Juan G."
   */
  async getPublicQueue(slug: string, date: string): Promise<{ position: number; name: string; status: string }[]> {
    const professional = await this.professionalsService.findBySlug(slug);
    const queue = await this.repo.find({
      where: [
        { professionalId: professional.id, date, status: AppointmentStatus.ARRIVED },
        { professionalId: professional.id, date, status: AppointmentStatus.IN_PROGRESS },
      ],
      relations: ['client'],
      order: { arrivedAt: 'ASC' },
    });
    return queue.map((appt, index) => {
      const parts    = (appt.client?.name ?? 'Paciente').trim().split(/\s+/);
      const first    = parts[0];
      const lastInit = parts.length > 1 ? `${parts[parts.length - 1][0].toUpperCase()}.` : '';
      return {
        position: index + 1,
        name:     lastInit ? `${first} ${lastInit}` : first,
        status:   appt.status,
      };
    });
  }

  /** Version liviana para polling: devuelve solo el queueUpdatedAt del profesional. */
  async getQueueVersion(slug: string): Promise<{ queueUpdatedAt: Date | null }> {
    const professional = await this.professionalsService.findBySlug(slug);
    return { queueUpdatedAt: professional.queueUpdatedAt ?? null };
  }

  /**
   * Expira citas PENDING sin acción — se ejecuta cada hora.
   *
   * LÓGICA CORRECTA:
   * Una cita expira cuando su fecha+hora ya pasó hace más de PENDING_EXPIRY_HOURS
   * (calculado sobre la fecha del turno, NO sobre cuándo se creó).
   *
   * Ejemplo: turno el jueves a las 10:00 con PENDING_EXPIRY_HOURS=2
   *   → expira el jueves a las 12:00 si sigue PENDING
   *   → NO expira el martes cuando se creó la reserva
   */
  @Cron(CronExpression.EVERY_HOUR)
  async expirePendingAppointments(): Promise<void> {
    const expiryHours = parseInt(process.env.PENDING_EXPIRY_HOURS ?? '2', 10);

    // Buscar citas PENDING cuya fecha+hora ya pasó hace más de expiryHours
    const now = new Date();
    const expired = await this.repo
      .createQueryBuilder('a')
      .where('a.status = :status', { status: AppointmentStatus.PENDING })
      // Comparar fecha del turno + startTime con la hora actual
      .andWhere(
        `TIMESTAMPADD(HOUR, :expiryHours, STR_TO_DATE(CONCAT(a.date, ' ', a.startTime), '%Y-%m-%d %H:%i')) < :now`,
        { expiryHours, now }
      )
      .getMany();

    if (expired.length > 0) {
      await this.repo
        .createQueryBuilder()
        .update(Appointment)
        .set({ status: AppointmentStatus.EXPIRED })
        .where('id IN (:...ids)', { ids: expired.map((a) => a.id) })
        .execute();
      console.log(`[Cron] ${expired.length} citas PENDING expiradas`);
    }
  }


  /**
   * Cron: corre todos los días a las 20:00.
   * Busca citas de mañana que sean CONFIRMED o RECONFIRMED y no tengan reminderSent,
   * les manda email automático al paciente y marca reminderSent=true.
   */
  @Cron('0 20 * * *') // Todos los días a las 20:00hs
  async sendAutomaticReminders(): Promise<void> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const appts = await this.repo.find({
      where: [
        { date: tomorrowStr, status: AppointmentStatus.CONFIRMED,   reminderSent: false },
        { date: tomorrowStr, status: AppointmentStatus.RECONFIRMED, reminderSent: false },
      ],
      relations: ['client', 'service'],
    });

    let sent = 0;
    for (const appt of appts) {
      try {
        const professional = await this.professionalsService.findOne(appt.professionalId);
        await this.notificationsService.sendAutomaticReminder(appt, appt.client, professional, appt.service);
        await this.repo.update(appt.id, { reminderSent: true });
        sent++;
      } catch (err) {
        console.error(`[Cron reminder] Error en cita ${appt.id}: ${err.message}`);
      }
    }
    if (sent > 0) console.log(`[Cron] ${sent} recordatorios automáticos enviados para ${tomorrowStr}`);
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  private async findById(id: number): Promise<Appointment> {
    const appt = await this.repo.findOne({ where: { id } });
    if (!appt) throw new NotFoundException('Cita no encontrada');
    return appt;
  }

  private async findOneByProfessional(id: number, professionalId: number): Promise<Appointment> {
    const appt = await this.repo.findOne({
      where: { id, professionalId },
      relations: ['professional'],
    });
    if (!appt) throw new NotFoundException('Cita no encontrada');
    return appt;
  }
}