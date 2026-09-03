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
import { resolveTzOffsetHours, localDateString } from '../../common/utils/timezone';

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
    // "Hoy" acá es la fecha-calendario local del PROFESIONAL (por prefijo de su
    // teléfono) — no la fecha UTC del servidor. Mismo bug que ya se corrigió en
    // getTomorrowAppointments()/sendAutomaticReminders(): cerca de medianoche UTC,
    // la fecha del servidor puede estar hasta 5hs adelantada respecto al país del
    // profesional, corriendo el límite de anticipación mínima/máxima un día.
    const todayStr      = localDateString(resolveTzOffsetHours(professional.phone));
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
    // Incluye ARRIVED e IN_PROGRESS: un paciente que ya llegó o está siendo
    // atendido sigue ocupando el horario tanto como uno RECONFIRMED — antes de
    // este fix el algoritmo dejaba de bloquear ese horario apenas se lo marcaba
    // ARRIVED, permitiendo que otra persona reservara encima mientras esperaba
    // o lo estaban atendiendo.
    // Trae también el servicio de cada cita (para su propio bufferMinutes) —
    // el margen que hay que dejar libre DESPUÉS de una cita ya existente es el
    // que configuró ESE servicio, no el del servicio que se está consultando ahora.
    const occupiedAppointments = await this.appointmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.service', 's')
      .where('a.professionalId = :professionalId', { professionalId })
      .andWhere('a.date = :date', { date })
      .andWhere('a.status IN (:...statuses)', {
        statuses: [
          AppointmentStatus.PENDING,
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.RECONFIRMED,
          AppointmentStatus.ARRIVED,
          AppointmentStatus.IN_PROGRESS,
          AppointmentStatus.COMPLETED,
        ],
      })
      .select(['a.startTime', 'a.endTime', 's.bufferMinutes'])
      .getMany();

    // Normalizar a minutos para comparación eficiente. buffer: el de SU propio
    // servicio, con el mismo fallback al perfil que usa el servicio candidato arriba.
    const occupied = occupiedAppointments.map((a) => ({
      start:  this.timeStringToMinutes(a.startTime.substring(0, 5)),
      end:    this.timeStringToMinutes(a.endTime.substring(0, 5)),
      buffer: a.service?.bufferMinutes ?? professional.bufferMinutes,
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
    occupied: { start: number; end: number; buffer: number }[],
  ): string[] {
    const slots: string[]   = [];
    const endMinutes        = this.timeStringToMinutes(endTime);
    let cursor              = this.timeStringToMinutes(startTime);

    while (cursor + durationMin <= endMinutes) {
      const slotEnd = cursor + durationMin;

      // Choca si el rango [cursor, slotEnd + MI buffer] se solapa con el rango
      // que ocupa la cita existente, extendido por SU PROPIO buffer de cierre
      // (appt.buffer) — no el buffer del servicio que estoy por reservar.
      const clash = occupied.find(
        (appt) => appt.start < slotEnd + bufferMin && appt.end + appt.buffer > cursor,
      );

      if (!clash) {
        // Slot libre — agregarlo y avanzar
        slots.push(this.minutesToTimeString(cursor));
        cursor += durationMin + bufferMin;
      } else {
        // Slot ocupado — saltar al final de la cita que choca + SU propio buffer
        cursor = clash.end + clash.buffer;
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
   *
   * Antes de este fix llamaba a getAvailableSlots() una vez por día — hasta 31
   * llamadas en secuencia, cada una con ~4-5 consultas a la base (profesional,
   * excepción, horario semanal, servicio, citas ocupadas) = hasta ~150 round-trips
   * a Aiven, uno atrás del otro. En una conexión inestable (el caso real: se usa
   * desde Venezuela) cada round-trip suma latencia real, no solo cómputo — el
   * usuario veía el calendario "colgado" varios segundos después de elegir un
   * servicio. Acá se trae todo lo necesario del mes en un puñado de consultas
   * (profesional, horario semanal, excepciones, citas ocupadas — todas una sola
   * vez) y el resto se calcula en memoria, día por día, sin volver a tocar la base.
   */
  async getAvailableDaysInMonth(
    professionalId: number,
    year: number,
    month: number,
    serviceId?: number,
  ): Promise<string[]> {
    const professional = await this.professionalsService.findOne(professionalId);
    const daysInMonth  = new Date(year, month, 0).getDate();
    const pad2 = (n: number) => n.toString().padStart(2, '0');
    const monthStart = `${year}-${pad2(month)}-01`;
    const monthEnd   = `${year}-${pad2(month)}-${pad2(daysInMonth)}`;

    const [weeklySchedule, exceptions] = await Promise.all([
      this.scheduleService.getWeeklySchedule(professionalId),
      this.scheduleService.getExceptions(professionalId), // ya filtra date >= CURDATE()
    ]);
    const exceptionsByDate = new Map(exceptions.map((e) => [e.date, e]));

    let slotDuration  = professional.slotDurationMinutes;
    let bufferMinutes = professional.bufferMinutes;
    if (serviceId) {
      try {
        const service = await this.servicesService.findOne(serviceId);
        if (service.durationMinutes) slotDuration = service.durationMinutes;
        if (service.bufferMinutes !== null && service.bufferMinutes !== undefined) {
          bufferMinutes = service.bufferMinutes;
        }
      } catch {
        // Si el servicio no se encuentra, continúa con los valores del perfil
      }
    }

    const occupiedAppointments = await this.appointmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.service', 's')
      .where('a.professionalId = :professionalId', { professionalId })
      .andWhere('a.date BETWEEN :start AND :end', { start: monthStart, end: monthEnd })
      .andWhere('a.status IN (:...statuses)', {
        statuses: [
          AppointmentStatus.PENDING,
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.RECONFIRMED,
          AppointmentStatus.ARRIVED,
          AppointmentStatus.IN_PROGRESS,
          AppointmentStatus.COMPLETED,
        ],
      })
      .select(['a.date', 'a.startTime', 'a.endTime', 's.bufferMinutes'])
      .getMany();

    const occupiedByDate = new Map<string, { start: number; end: number; buffer: number }[]>();
    for (const a of occupiedAppointments) {
      const list = occupiedByDate.get(a.date) ?? [];
      list.push({
        start:  this.timeStringToMinutes(a.startTime.substring(0, 5)),
        end:    this.timeStringToMinutes(a.endTime.substring(0, 5)),
        buffer: a.service?.bufferMinutes ?? professional.bufferMinutes,
      });
      occupiedByDate.set(a.date, list);
    }

    // Mismo criterio que getAvailableSlots() cuando se lo llama sin localNow
    // (que es como este método siempre lo invoca): "hoy" para el límite de
    // anticipación es la fecha local del profesional; "hoy" para el filtro de
    // slots ya pasados del día actual sigue comparando contra la fecha UTC del
    // servidor — se preserva tal cual para no cambiar de comportamiento acá.
    const offset    = resolveTzOffsetHours(professional.phone);
    const todayDate = new Date(localDateString(offset) + 'T12:00:00Z');
    const todayUTC  = new Date().toISOString().split('T')[0];

    const availableDays: string[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${pad2(month)}-${pad2(day)}`;

      const requestedDate = new Date(date + 'T12:00:00Z');
      const diffDays = (requestedDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays * 24 < professional.minAdvanceHours) continue;
      if (diffDays > professional.maxAdvanceDays) continue;

      let scheduleForDate: { startTime: string; endTime: string } | null = null;
      const exception = exceptionsByDate.get(date);
      if (exception) {
        if (!exception.isClosed) {
          scheduleForDate = { startTime: exception.customStartTime, endTime: exception.customEndTime };
        }
      } else {
        const dayOfWeek   = new Date(date + 'T12:00:00').getDay();
        const daySchedule = weeklySchedule.find((s) => s.dayOfWeek === dayOfWeek && s.isActive);
        if (daySchedule) scheduleForDate = { startTime: daySchedule.startTime, endTime: daySchedule.endTime };
      }
      if (!scheduleForDate) continue;

      let slots = this.calculateDynamicSlots(
        scheduleForDate.startTime,
        scheduleForDate.endTime,
        slotDuration,
        bufferMinutes,
        occupiedByDate.get(date) ?? [],
      );

      if (date === todayUTC) {
        const minMinutes = professional.minAdvanceHours * 60;
        slots = slots.filter((slot) => this.timeStringToMinutes(slot) >= minMinutes);
      }

      if (slots.length > 0) availableDays.push(date);
    }

    return availableDays;
  }
}