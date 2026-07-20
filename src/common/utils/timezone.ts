/**
 * timezone.ts — Resolución de huso horario por prefijo de teléfono (+54 AR / +58 VE)
 * y utilidades de fecha-calendario local, para no depender de la hora del servidor
 * (Render corre en UTC). Mismo patrón que usa TuCatálogo (orders.service.ts →
 * getLocalDayRangeUtc): comparar por fecha-calendario del servidor rompe cerca de
 * medianoche UTC, que es plena tarde/noche en Argentina y Venezuela.
 */
const PHONE_PREFIX_TZ_OFFSET: { prefix: string; offset: number }[] = [
  { prefix: '54', offset: -3 }, // Argentina
  { prefix: '58', offset: -4 }, // Venezuela
];

const DEFAULT_OFFSET_HOURS = -3; // Argentina, mercado principal

export const SUPPORTED_TZ_OFFSETS = PHONE_PREFIX_TZ_OFFSET.map((p) => p.offset);

export function resolveTzOffsetHours(phone: string | null | undefined): number {
  const digits = (phone ?? '').replace(/\D/g, '');
  const match = PHONE_PREFIX_TZ_OFFSET.find((p) => digits.startsWith(p.prefix));
  return match?.offset ?? DEFAULT_OFFSET_HOURS;
}

/** Fecha calendario 'YYYY-MM-DD' en la hora local dada por offsetHours. */
export function localDateString(offsetHours: number, at: Date = new Date()): string {
  const shifted = new Date(at.getTime() + offsetHours * 3600_000);
  return shifted.toISOString().split('T')[0];
}

/** Suma (o resta, con negativos) días a una fecha 'YYYY-MM-DD'. */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/** Normaliza un Date o string de columna `date` de TypeORM a 'YYYY-MM-DD'. */
export function dateOnly(d: Date | string): string {
  return (typeof d === 'string' ? d : d.toISOString()).split('T')[0];
}
