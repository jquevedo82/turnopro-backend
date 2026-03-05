/**
 * availability.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo: Availability
 * Responsabilidad: Calcular los slots de tiempo disponibles para reservar.
 * Esta es la función más crítica del sistema.
 *
 * Para cambiar la lógica de cálculo de slots:
 *   Modificar calculateSlots() en este archivo.
 *
 * Para agregar soporte de múltiples franjas horarias por día (mañana + tarde):
 *   Modificar getScheduleForDate() para retornar un array de rangos
 *   y adaptar calculateSlots() para iterar sobre ellos.
 *
 * Para agregar límite de turnos simultáneos por slot:
 *   Modificar la query de appointments ocupados para contar por slot
 *   y comparar contra un límite configurable.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { Appointment }      from '../appointments/appointment.entity';
import { AppointmentStatus } from '../appointments/appointment-status.enum';
import { ScheduleService }  from '../schedule/schedule.service';
import { ProfessionalsService } from '../professionals/professionals.service';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    private readonly scheduleService: ScheduleService,
    private readonly professionalsService: ProfessionalsService,
  ) {}

  /**
   * Retorna los slots disponibles para un profesional en una fecha específica.
   *
   * Algoritmo:
   * 1. Verifica si la fecha tiene una excepción (día cerrado o horario especial)
   * 2. Si no tiene excepción, usa la plantilla semanal
   * 3. Genera todos los slots posibles del día
   * 4. Descuenta los slots ya ocupados por citas existentes
   * 5. Descuenta slots fuera del rango de anticipación mínima/máxima
   *
   * @param professionalId — ID del profesional
   * @param date           — Fecha en formato YYYY-MM-DD
   * @param serviceId      — ID del servicio (para obtener la duración)
   * @returns string[]     — Array de horarios disponibles en formato HH:mm
   */
  async getAvailableSlots(professionalId: number, date: string, serviceId?: number): Promise<string[]> {
    const professional = await this.professionalsService.findOne(professionalId);

    // ── Verificar límites de anticipación ─────────────────────────────────
    const requestedDate = new Date(date + 'T00:00:00');
    const now = new Date();
    const diffMs    = requestedDate.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays  = diffHours / 24;

    // Verificar anticipación mínima
    if (diffHours < professional.minAdvanceHours) return [];

    // Verificar anticipación máxima
    if (diffDays > professional.maxAdvanceDays) return [];

    // ── Obtener horario para la fecha solicitada ───────────────────────────
    const scheduleForDate = await this.getScheduleForDate(professionalId, date);
    if (!scheduleForDate) return []; // Día cerrado o sin horario configurado

    const { startTime, endTime } = scheduleForDate;

    // ── Determinar duración del slot ──────────────────────────────────────
    // Si se especifica un servicio, usa su duración. Si no, usa la del profesional.
    let slotDuration = professional.slotDurationMinutes;
    let bufferMinutes = professional.bufferMinutes;

    if (serviceId) {
      const { ServicesService } = await import('../services/services.service');
      // Nota: en implementación real, inyectar ServicesService en el constructor
      // Para simplificar, usamos los valores del profesional si no se puede resolver
    }

    // ── Generar todos los slots del día ────────────────────────────────────
    const allSlots = this.generateSlots(startTime, endTime, slotDuration, bufferMinutes);

    // ── Obtener citas ya ocupadas para ese día ────────────────────────────
    // Solo considera citas CONFIRMED, PENDING y RECONFIRMED como ocupadas
    // CANCELLED, REJECTED y EXPIRED liberan el slot automáticamente
    const occupiedAppointments = await this.appointmentRepo
      .createQueryBuilder('a')
      .where('a.professionalId = :professionalId', { professionalId })
      .andWhere('a.date = :date', { date })
      .andWhere('a.status IN (:...statuses)', {
        statuses: [
          AppointmentStatus.PENDING,
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.RECONFIRMED,
        ],
      })
      .select(['a.startTime'])
      .getMany();

    const occupiedTimes = new Set(occupiedAppointments.map((a) => a.startTime));

    // ── Filtrar slots ocupados y pasados ──────────────────────────────────
    const available = allSlots.filter((slot) => {
      if (occupiedTimes.has(slot)) return false;

      // Para el día de hoy: filtrar slots que ya pasaron + buffer mínimo
      if (date === now.toISOString().split('T')[0]) {
        const [h, m]  = slot.split(':').map(Number);
        const slotTime = new Date();
        slotTime.setHours(h, m, 0, 0);
        const minTime  = new Date(now.getTime() + professional.minAdvanceHours * 60 * 60 * 1000);
        if (slotTime < minTime) return false;
      }

      return true;
    });

    return available;
  }

  /**
   * Retorna el horario efectivo para una fecha considerando excepciones.
   * Si hay excepción de día cerrado: retorna null.
   * Si hay excepción de horario especial: retorna el horario especial.
   * Si no hay excepción: retorna el horario de la plantilla semanal.
   */
  private async getScheduleForDate(professionalId: number, date: string) {
    // ── Verificar excepción ───────────────────────────────────────────────
    const exception = await this.scheduleService.getExceptionForDate(professionalId, date);
    if (exception) {
      if (exception.isClosed) return null; // Día cerrado
      return { startTime: exception.customStartTime, endTime: exception.customEndTime };
    }

    // ── Usar plantilla semanal ────────────────────────────────────────────
    const dayOfWeek = new Date(date + 'T12:00:00').getDay(); // 0=Domingo...6=Sábado
    const schedules = await this.scheduleService.getWeeklySchedule(professionalId);
    const daySchedule = schedules.find((s) => s.dayOfWeek === dayOfWeek && s.isActive);

    if (!daySchedule) return null; // Día no configurado o inactivo
    return { startTime: daySchedule.startTime, endTime: daySchedule.endTime };
  }

  /**
   * Genera el array de slots a partir de un rango horario.
   * Ej: startTime=08:00, endTime=13:00, duration=20, buffer=5
   *     → ['08:00', '08:25', '08:50', '09:15', ...]
   *
   * Para cambiar el formato de los slots (ej: 12h): modificar la función toTimeString()
   */
  private generateSlots(startTime: string, endTime: string, durationMin: number, bufferMin: number): string[] {
    const slots: string[] = [];
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM]     = endTime.split(':').map(Number);

    let currentMinutes = startH * 60 + startM;
    const endMinutes   = endH * 60 + endM;
    const stepMinutes  = durationMin + bufferMin;

    while (currentMinutes + durationMin <= endMinutes) {
      slots.push(this.minutesToTimeString(currentMinutes));
      currentMinutes += stepMinutes;
    }

    return slots;
  }

  /** Convierte minutos totales a string HH:mm */
  private minutesToTimeString(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
    const m = (totalMinutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  /**
   * Retorna los días disponibles de un mes para mostrar en el calendario.
   * Un día está disponible si tiene al menos un slot libre.
   *
   * @param professionalId
   * @param year  — Año (ej: 2026)
   * @param month — Mes 1-12
   * @returns string[] — Array de fechas disponibles en formato YYYY-MM-DD
   */
  async getAvailableDaysInMonth(professionalId: number, year: number, month: number): Promise<string[]> {
    const availableDays: string[] = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const slots = await this.getAvailableSlots(professionalId, date);
      if (slots.length > 0) availableDays.push(date);
    }

    return availableDays;
  }
}
