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
    return appointment;
  }

  async confirm(id: number, professionalId: number): Promise<Appointment> {
    const appt = await this.findOneByProfessional(id, professionalId);
    if (appt.status !== AppointmentStatus.PENDING) {
      throw new BadRequestException('Solo se pueden confirmar citas en estado PENDIENTE');
    }
    await this.repo.update(id, { status: AppointmentStatus.CONFIRMED });
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
    return this.findById(id);
  }

  async reconfirm(token: string, by: 'client' | 'professional'): Promise<Appointment> {
    const appt = await this.repo.findOne({ where: { token } });
    if (!appt) throw new NotFoundException('Cita no encontrada');
    if (appt.status === AppointmentStatus.RECONFIRMED) return appt;
    if (appt.status !== AppointmentStatus.CONFIRMED) {
      throw new BadRequestException('La cita no puede ser reconfirmada en su estado actual');
    }
    await this.repo.update(appt.id, {
      status:        AppointmentStatus.RECONFIRMED,
      reconfirmedAt: new Date(),
      reconfirmedBy: by,
    });
    return this.repo.findOne({ where: { token }, relations: ['client', 'service', 'professional'] }) as Promise<Appointment>;
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
      where: { professionalId, date: tomorrowStr, status: AppointmentStatus.CONFIRMED },
      relations: ['client', 'service'],
      order: { startTime: 'ASC' },
    });
  }

  async markReminderSent(id: number, professionalId: number): Promise<Appointment> {
    await this.findOneByProfessional(id, professionalId);
    await this.repo.update(id, { reminderSent: true });
    return this.findById(id);
  }

  async complete(id: number, professionalId: number): Promise<Appointment> {
    const appt = await this.findOneByProfessional(id, professionalId);
    if (appt.status !== AppointmentStatus.CONFIRMED && appt.status !== AppointmentStatus.RECONFIRMED) {
      throw new BadRequestException('Solo se pueden completar citas confirmadas o reconfirmadas');
    }
    await this.repo.update(id, { status: AppointmentStatus.COMPLETED });
    return this.findById(id);
  }

  /** Expira citas PENDING sin acción — se ejecuta cada hora */
  @Cron(CronExpression.EVERY_HOUR)
  async expirePendingAppointments(): Promise<void> {
    const expiryHours = parseInt(process.env.PENDING_EXPIRY_HOURS ?? '2', 10);
    const expiryTime  = new Date(Date.now() - expiryHours * 60 * 60 * 1000);

    const expired = await this.repo
      .createQueryBuilder('a')
      .where('a.status = :status', { status: AppointmentStatus.PENDING })
      .andWhere('a.createdAt < :expiryTime', { expiryTime })
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
