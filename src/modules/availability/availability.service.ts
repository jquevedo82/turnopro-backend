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
import { ServicesService }  from '../services/services.service';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    private readonly scheduleService: ScheduleService,
    private readonly professionalsService: ProfessionalsService,
    private readonly servicesService: ServicesService,   // ← inyectado
  ) {}

  /**
   * Retorna los slots disponibles para un profesional en una fecha específica.
   *
   * Algoritmo (slots dinámicos por servicio):
   * 1. Verifica si la fecha tiene una excepción (día cerrado o horario especial)
   * 2. Si no tiene excepción, usa la plantilla semanal
   * 3. Determina duración y buffer según el servicio (con fallback al perfil)
   * 4. Genera slots dinámicamente: al encontrar una cita que choca, salta
   *    al final de esa cita en lugar de avanzar de a un slot fijo
   * 5. Descuenta slots fuera del rango de anticipación mínima/máxima
   *
   * @param professionalId — ID del profesional
   * @param date           — Fecha en formato YYYY-MM-DD
   * @param serviceId      — ID del servicio (para obtener duración y buffer)
   * @returns string[]     — Array de horarios disponibles en formato HH:mm
   */
  async getAvailableSlots(
    professionalId: number,
    date: string,
    serviceId?: number,
    localNow?: string,   // HH:mm hora local del cliente (ej: "22:30")
  ): Promise<string[]> {
    const professional = await this.professionalsService.findOne(professionalId);

    // ── Normalizar hora local del cliente ────────────────────────────────
    // localNow (HH:mm) viene del frontend cuando consulta el día actual.
    // Si está presente → es "hoy" desde la perspectiva del cliente.
    // Si no viene → fallback UTC del servidor (comportamiento previo).
    const localNowMinutes: number | null = localNow
      ? this.timeStringToMinutes(localNow)
      : null;

    // isToday: si el frontend mandó localNow, está preguntando por hoy.
    // Fallback: comparar con la fecha UTC del servidor.
    const isToday = localNow != null
      ? true
      : date === new Date().toISOString().split('T')[0];

    // ── Verificar límites de anticipación ─────────────────────────────────
    // Comparamos fechas como strings (YYYY-MM-DD) para no depender de UTC.
    const todayStr      = new Date().toISOString().split('T')[0];
    const requestedDate = new Date(date      + 'T12:00:00Z');
    const todayDate     = new Date(todayStr  + 'T12:00:00Z');
    const diffDays      = (requestedDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24);

    if (isToday && localNowMinutes !== null) {
      // Para hoy: solo bloqueamos si minAdvanceHours >= 24 (ningún slot del día alcanza).
      // El filtro exacto de slots pasados se hace más abajo, slot a slot.
      if (professional.minAdvanceHours >= 24) return [];
    } else if (diffDays * 24 < professional.minAdvanceHours) {
      return [];
    }
    if (diffDays > professional.maxAdvanceDays) return [];

    // ── Obtener horario para la fecha solicitada ───────────────────────────
    const scheduleForDate = await this.getScheduleForDate(professionalId, date);
    if (!scheduleForDate) return [];

    const { startTime, endTime } = scheduleForDate;

    // ── Determinar duración y buffer según el servicio ────────────────────
    // Si se recibe serviceId → usa service.durationMinutes y service.bufferMinutes
    // Si service.bufferMinutes es null → fallback al bufferMinutes del perfil
    // Si no hay serviceId → usa los valores base del perfil
    let slotDuration  = professional.slotDurationMinutes;
    let bufferMinutes = professional.bufferMinutes;

    if (serviceId) {
      try {
        const service = await this.servicesService.findOne(serviceId);
        if (service.durationMinutes) {
          slotDuration = service.durationMinutes;
        }
        if (service.bufferMinutes !== null && service.bufferMinutes !== undefined) {
          bufferMinutes = service.bufferMinutes;
        }
        // Si service.bufferMinutes es null → conserva el bufferMinutes del perfil
      } catch {
        // Si el servicio no se encuentra, continúa con los valores del perfil
      }
    }

    // ── Obtener citas ya ocupadas para ese día ────────────────────────────
    // Incluye startTime y endTime para el algoritmo de salto
    const occupiedAppointments = await this.appointmentRepo
      .createQueryBuilder('a')
      .where('a.professionalId = :professionalId', { professionalId })
      .andWhere('a.date = :date', { date })
      .andWhere('a.status IN (:...statuses)', {
        statuses: [
          AppointmentStatus.PENDING,
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.RECONFIRMED,
          AppointmentStatus.COMPLETED,
        ],
      })
      .select(['a.startTime', 'a.endTime'])
      .getMany();

    // Normalizar a minutos para comparación eficiente
    const occupied = occupiedAppointments.map((a) => ({
      start: this.timeStringToMinutes(a.startTime.substring(0, 5)),
      end:   this.timeStringToMinutes(a.endTime.substring(0, 5)),
    }));

    // ── Calcular slots con algoritmo dinámico ─────────────────────────────
    const slots = this.calculateDynamicSlots(
      startTime,
      endTime,
      slotDuration,
      bufferMinutes,
      occupied,
    );

    // ── Filtrar slots pasados (solo para hoy) ─────────────────────────────
    // Usa localNowMinutes (hora local del cliente) para no depender del UTC del servidor.
    if (isToday) {
      const minMinutes = (localNowMinutes ?? 0) + professional.minAdvanceHours * 60;
      return slots.filter((slot) => this.timeStringToMinutes(slot) >= minMinutes);
    }

    return slots;
  }

  /**
   * Algoritmo de slots dinámicos.
   *
   * En lugar de generar todos los slots y filtrar los ocupados,
   * avanza con un cursor y cuando encuentra una cita que choca
   * salta directamente al final de esa cita + buffer.
   *
   * Esto es necesario para que servicios de distinta duración
   * no generen slots superpuestos con citas existentes.
   *
   * Ejemplo con duration=60, buffer=5:
   *   - Cursor 08:00 → fin sería 09:05. Hay cita 08:30-09:00 → choca
   *   - Cursor salta a 09:00 + 5 buffer = 09:05
   *   - Cursor 09:05 → fin sería 10:10. Libre → agrega 09:05
   *   - Cursor avanza a 10:10...
   */
  private calculateDynamicSlots(
    startTime: string,
    endTime: string,
    durationMin: number,
    bufferMin: number,
    occupied: { start: number; end: number }[],
  ): string[] {
    const slots: string[]   = [];
    const endMinutes        = this.timeStringToMinutes(endTime);
    let cursor              = this.timeStringToMinutes(startTime);

    while (cursor + durationMin <= endMinutes) {
      const slotEnd = cursor + durationMin;

      // Buscar si alguna cita choca con el rango [cursor, slotEnd + buffer]
      const clash = occupied.find(
        (appt) => appt.start < slotEnd + bufferMin && appt.end > cursor,
      );

      if (!clash) {
        // Slot libre — agregarlo y avanzar
        slots.push(this.minutesToTimeString(cursor));
        cursor += durationMin + bufferMin;
      } else {
        // Slot ocupado — saltar al final de la cita que choca + buffer
        cursor = clash.end + bufferMin;
      }
    }

    return slots;
  }

  /**
   * Retorna el horario efectivo para una fecha considerando excepciones.
   * Si hay excepción de día cerrado: retorna null.
   * Si hay excepción de horario especial: retorna el horario especial.
   * Si no hay excepción: retorna el horario de la plantilla semanal.
   */
  private async getScheduleForDate(professionalId: number, date: string) {
    const exception = await this.scheduleService.getExceptionForDate(professionalId, date);
    if (exception) {
      if (exception.isClosed) return null;
      return { startTime: exception.customStartTime, endTime: exception.customEndTime };
    }

    const dayOfWeek   = new Date(date + 'T12:00:00').getDay();
    const schedules   = await this.scheduleService.getWeeklySchedule(professionalId);
    const daySchedule = schedules.find((s) => s.dayOfWeek === dayOfWeek && s.isActive);

    if (!daySchedule) return null;
    return { startTime: daySchedule.startTime, endTime: daySchedule.endTime };
  }

  /** Convierte 'HH:mm' a minutos totales */
  private timeStringToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  /** Convierte minutos totales a string 'HH:mm' */
  private minutesToTimeString(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
    const m = (totalMinutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  /**
   * Retorna los días disponibles de un mes para mostrar en el calendario.
   * Un día está disponible si tiene al menos un slot libre.
   */
  async getAvailableDaysInMonth(
    professionalId: number,
    year: number,
    month: number,
    serviceId?: number,
  ): Promise<string[]> {
    const availableDays: string[] = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date  = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const slots = await this.getAvailableSlots(professionalId, date, serviceId);
      if (slots.length > 0) availableDays.push(date);
    }

    return availableDays;
  }
}