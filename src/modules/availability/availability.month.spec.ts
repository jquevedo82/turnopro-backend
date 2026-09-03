/**
 * availability.month.spec.ts
 * Fix de performance (2026-09-03): getAvailableDaysInMonth() llamaba a
 * getAvailableSlots() una vez por día del mes — hasta 31 llamadas en secuencia,
 * cada una con ~4-5 consultas a la base, hasta ~150 round-trips para un solo mes.
 * En una conexión inestable (el caso real: Venezuela) esto se sentía como que el
 * calendario quedaba colgado varios segundos después de elegir un servicio.
 * Ahora trae todo lo del mes en un puñado de consultas fijas y calcula el resto
 * en memoria — estos tests verifican tanto el conteo de consultas como que el
 * resultado sigue siendo el correcto (excepciones, ocupación, límites de anticipación).
 */
import { AvailabilityService } from './availability.service';

function makeQueryBuilder(occupied: any[]) {
  const qb: any = {};
  qb.leftJoinAndSelect = jest.fn().mockReturnValue(qb);
  qb.where             = jest.fn().mockReturnValue(qb);
  qb.andWhere          = jest.fn().mockReturnValue(qb);
  qb.select            = jest.fn().mockReturnValue(qb);
  qb.getMany           = jest.fn().mockResolvedValue(occupied);
  return qb;
}

function makeService(opts: {
  occupied?: any[];
  exceptions?: any[];
  weeklySchedule?: any[];
  professional?: any;
  service?: any;
} = {}) {
  const qb = makeQueryBuilder(opts.occupied ?? []);
  const appointmentRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
  const scheduleService = {
    getWeeklySchedule: jest.fn().mockResolvedValue(opts.weeklySchedule ?? []),
    getExceptions:     jest.fn().mockResolvedValue(opts.exceptions ?? []),
  };
  const professionalsService = {
    findOne: jest.fn().mockResolvedValue(opts.professional ?? {
      id: 1, phone: '+5491112345678',
      minAdvanceHours: 0, maxAdvanceDays: 60,
      slotDurationMinutes: 30, bufferMinutes: 0,
    }),
  };
  const servicesService = {
    findOne: jest.fn().mockResolvedValue(opts.service ?? { durationMinutes: 30, bufferMinutes: 0 }),
  };
  const svc = new (AvailabilityService as any)(appointmentRepo, scheduleService, professionalsService, servicesService);
  return { svc, appointmentRepo, scheduleService, professionalsService, servicesService, qb };
}

// Día de prueba fijo dentro del mes consultado (setiembre 2026) + su día de la
// semana calculado dinámicamente, como ya hace el resto de la suite.
const TEST_DAY   = '2026-09-15';
const TEST_DOW   = new Date(`${TEST_DAY}T12:00:00`).getDay();

describe('AvailabilityService.getAvailableDaysInMonth() — performance', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-01T12:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('consulta la base un número fijo de veces, sin importar cuántos días tenga el mes', async () => {
    const { svc, appointmentRepo, scheduleService, professionalsService } = makeService({
      weeklySchedule: [{ dayOfWeek: TEST_DOW, isActive: true, startTime: '09:00', endTime: '18:00' }],
    });

    const days = await svc.getAvailableDaysInMonth(1, 2026, 9); // setiembre tiene 30 días

    expect(professionalsService.findOne).toHaveBeenCalledTimes(1);
    expect(scheduleService.getWeeklySchedule).toHaveBeenCalledTimes(1);
    expect(scheduleService.getExceptions).toHaveBeenCalledTimes(1);
    expect(appointmentRepo.createQueryBuilder).toHaveBeenCalledTimes(1); // una sola query de ocupados para TODO el mes
    expect(days).toContain(TEST_DAY);
  });

  it('excluye un día con excepción de cierre aunque el horario semanal lo habilitaría', async () => {
    const { svc } = makeService({
      weeklySchedule: [{ dayOfWeek: TEST_DOW, isActive: true, startTime: '09:00', endTime: '18:00' }],
      exceptions: [{ date: TEST_DAY, isClosed: true }],
    });

    const days = await svc.getAvailableDaysInMonth(1, 2026, 9);

    expect(days).not.toContain(TEST_DAY);
  });

  it('usa el horario especial de una excepción con horario custom, sin depender del horario semanal', async () => {
    const { svc } = makeService({
      weeklySchedule: [], // sin plantilla semanal activa ese día
      exceptions: [{ date: TEST_DAY, isClosed: false, customStartTime: '14:00', customEndTime: '15:00' }],
    });

    const days = await svc.getAvailableDaysInMonth(1, 2026, 9);

    expect(days).toContain(TEST_DAY);
  });

  it('excluye un día completamente ocupado', async () => {
    const { svc } = makeService({
      weeklySchedule: [{ dayOfWeek: TEST_DOW, isActive: true, startTime: '09:00', endTime: '18:00' }],
      occupied: [{ date: TEST_DAY, startTime: '09:00:00', endTime: '18:00:00', service: { bufferMinutes: 0 } }],
    });

    const days = await svc.getAvailableDaysInMonth(1, 2026, 9);

    expect(days).not.toContain(TEST_DAY);
  });

  it('respeta maxAdvanceDays — un día del mes que excede el límite de anticipación queda afuera', async () => {
    const { svc } = makeService({
      weeklySchedule: [{ dayOfWeek: TEST_DOW, isActive: true, startTime: '09:00', endTime: '18:00' }],
      professional: {
        id: 1, phone: '+5491112345678',
        minAdvanceHours: 0, maxAdvanceDays: 5, // "hoy" es 2026-09-01 → corta el 2026-09-06
        slotDurationMinutes: 30, bufferMinutes: 0,
      },
    });

    const days = await svc.getAvailableDaysInMonth(1, 2026, 9);

    expect(days).not.toContain(TEST_DAY); // 15 de setiembre excede el límite de 5 días
  });
});
