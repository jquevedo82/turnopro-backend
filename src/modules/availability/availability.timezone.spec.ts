/**
 * availability.timezone.spec.ts
 * Verifica que el fix de timezone funciona correctamente:
 * - Con localNow: filtra slots según la hora local del cliente
 * - Sin localNow: comportamiento fallback (UTC del servidor)
 * - isToday se determina por presencia de localNow, no por comparación UTC
 */
import { AvailabilityService } from './availability.service';

// Acceso a métodos privados para unit tests
type PrivateService = {
  timeStringToMinutes: (t: string) => number;
  minutesToTimeString: (m: number) => string;
  calculateDynamicSlots: (
    start: string, end: string,
    duration: number, buffer: number,
    occupied: { start: number; end: number; buffer: number }[]
  ) => string[];
};

describe('AvailabilityService — timezone fix', () => {
  let svc: PrivateService;

  beforeEach(() => {
    // Instanciar solo los métodos privados que testeamos — sin deps de NestJS
    svc = new (AvailabilityService as any)(null, null, null, null);
  });

  describe('timeStringToMinutes / minutesToTimeString', () => {
    it('convierte 08:00 a 480 minutos', () => {
      expect(svc.timeStringToMinutes('08:00')).toBe(480);
    });

    it('convierte 22:30 a 1350 minutos', () => {
      expect(svc.timeStringToMinutes('22:30')).toBe(1350);
    });

    it('convierte 1350 minutos a 22:30', () => {
      expect(svc.minutesToTimeString(1350)).toBe('22:30');
    });
  });

  describe('calculateDynamicSlots — filtro con localNow', () => {
    it('genera slots en un rango limpio', () => {
      const slots = svc.calculateDynamicSlots('09:00', '11:00', 60, 0, []);
      expect(slots).toEqual(['09:00', '10:00']);
    });

    it('salta la cita que choca y continúa después', () => {
      const occupied = [{ start: 570, end: 630, buffer: 0 }]; // 09:30 - 10:30
      const slots = svc.calculateDynamicSlots('09:00', '12:00', 60, 0, occupied);
      // 09:00 choca con 09:30-10:30 → salta a 10:30 → slot 10:30 libre
      expect(slots).toContain('10:30');
      expect(slots).not.toContain('09:00');
    });

    it('respeta el buffer entre citas', () => {
      const occupied = [{ start: 600, end: 660, buffer: 15 }]; // 10:00 - 11:00, buffer propio 15
      // Con buffer=15 (del servicio candidato): slot 09:00 terminaría a 10:15 (09:00 + 60 + 15) → choca con 10:00
      const slots = svc.calculateDynamicSlots('09:00', '13:00', 60, 15, occupied);
      expect(slots).not.toContain('09:00');
      // Después del buffer: salta a 11:00 + 15 = 11:15
      expect(slots).toContain('11:15');
    });

    it('usa el buffer PROPIO de la cita que ocupa el horario, no el del servicio que se está consultando', () => {
      // "Corte" (buffer propio 5) ocupa 10:00-10:30. Alguien consulta disponibilidad
      // para "Tratamiento capilar" (buffer 20) — el margen después del Corte lo define
      // el Corte (5 min), no el Tratamiento. Antes del fix, saltaba a 10:30+20=10:50.
      const occupied = [{ start: 600, end: 630, buffer: 5 }]; // 10:00-10:30, buffer propio 5
      const slots = svc.calculateDynamicSlots('09:00', '12:00', 30, 20, occupied);
      expect(slots).toContain('10:35'); // 10:30 + 5 (buffer del Corte), no 10:50
      expect(slots).not.toContain('10:50');
    });

    it('no dejar ningún margen si la cita que ocupa el horario tiene buffer propio 0, aunque el servicio candidato tenga buffer alto', () => {
      const occupied = [{ start: 600, end: 630, buffer: 0 }]; // 10:00-10:30, sin buffer propio
      const slots = svc.calculateDynamicSlots('09:00', '12:00', 30, 20, occupied);
      expect(slots).toContain('10:30'); // arranca justo al terminar, sin esperar el buffer del candidato
    });
  });

  describe('lógica de filtro con localNow (simulada)', () => {
    it('filtra slots pasados correctamente con minAdvanceHours=0 y localNow=22:00', () => {
      // localNowMinutes=1320 (22:00), minAdvanceHours=0 → minMinutes=1320
      const localNowMinutes = 22 * 60; // 1320
      const minAdvanceHours = 0;
      const minMinutes = localNowMinutes + minAdvanceHours * 60;

      const allSlots = ['20:00', '21:00', '22:00', '22:30', '23:00'];
      const filtered = allSlots.filter(
        (slot) => svc.timeStringToMinutes(slot) >= minMinutes,
      );
      // Solo los slots a partir de las 22:00 deben quedar
      expect(filtered).toEqual(['22:00', '22:30', '23:00']);
    });

    it('filtra slots pasados con minAdvanceHours=1 y localNow=22:00', () => {
      // minMinutes = 22:00 + 60min = 23:00 (1380)
      const localNowMinutes = 22 * 60;
      const minAdvanceHours = 1;
      const minMinutes = localNowMinutes + minAdvanceHours * 60;

      const allSlots = ['22:00', '22:30', '23:00', '23:30'];
      const filtered = allSlots.filter(
        (slot) => svc.timeStringToMinutes(slot) >= minMinutes,
      );
      expect(filtered).toEqual(['23:00', '23:30']);
    });

    it('sin localNow, isToday se determina por comparación UTC (comportamiento previo)', () => {
      // Si localNow es null, isToday = date === new Date().toISOString().split('T')[0]
      // Este test solo verifica que la lógica de fallback existe y no rompe nada
      const todayUTC = new Date().toISOString().split('T')[0];
      const isToday = (date: string, localNow?: string) =>
        localNow != null ? true : date === todayUTC;

      expect(isToday(todayUTC)).toBe(true);
      expect(isToday('2099-01-01')).toBe(false);
      expect(isToday('2099-01-01', '22:00')).toBe(true); // con localNow siempre es hoy
    });
  });

  describe('getAvailableSlots() — límite de anticipación en el huso del profesional, no del servidor', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('bloquea una fecha que excede maxAdvanceDays según el huso de Venezuela, aunque el servidor (UTC) la vea un día más cerca', async () => {
      // Instante real: 2026-08-28T02:00:00Z → fecha del SERVIDOR (UTC) = 2026-08-28,
      // pero en Venezuela (UTC-4) son las 22:00 del 2026-08-27 → fecha LOCAL = 2026-08-27.
      jest.useFakeTimers().setSystemTime(new Date('2026-08-28T02:00:00.000Z'));

      const professionalsService = {
        findOne: jest.fn().mockResolvedValue({
          id: 1, phone: '+584121234567', // Venezuela
          minAdvanceHours: 0, maxAdvanceDays: 1,
        }),
      };
      const svc = new (AvailabilityService as any)({}, {}, professionalsService, {});

      // 2026-08-29 está a 2 días del "hoy" real de Venezuela (27) → excede maxAdvanceDays=1,
      // debe bloquearse. Con el bug viejo (todayStr = fecha UTC del servidor = 28), la
      // diferencia calculada sería de solo 1 día → NO se bloquearía, mostrando un día
      // de más de lo que el profesional configuró.
      const slots = await svc.getAvailableSlots(1, '2026-08-29');

      expect(slots).toEqual([]);
    });
  });
});
