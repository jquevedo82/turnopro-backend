import { resolveTzOffsetHours, localDateString, addDays, dateOnly } from './timezone';

describe('resolveTzOffsetHours', () => {
  it('resuelve Argentina (+54) a -3', () => {
    expect(resolveTzOffsetHours('+5491112345678')).toBe(-3);
  });

  it('resuelve Venezuela (+58) a -4', () => {
    expect(resolveTzOffsetHours('+584121234567')).toBe(-4);
  });

  it('usa -3 (Argentina) como fallback si no matchea ningún prefijo', () => {
    expect(resolveTzOffsetHours('+5511999999999')).toBe(-3); // Brasil, no soportado
  });

  it('usa -3 como fallback si el teléfono es null/undefined/vacío', () => {
    expect(resolveTzOffsetHours(null)).toBe(-3);
    expect(resolveTzOffsetHours(undefined)).toBe(-3);
    expect(resolveTzOffsetHours('')).toBe(-3);
  });
});

describe('localDateString', () => {
  it('resta horas del offset para obtener la fecha local (Argentina, UTC-3)', () => {
    // 2026-08-02 01:30 UTC → 2026-08-01 22:30 en Argentina — sigue siendo "ayer"
    const at = new Date('2026-08-02T01:30:00Z');
    expect(localDateString(-3, at)).toBe('2026-08-01');
  });

  it('el mismo instante ya es "hoy" en UTC pero no en Argentina', () => {
    const at = new Date('2026-08-02T01:30:00Z');
    expect(localDateString(0, at)).toBe('2026-08-02');
  });

  it('Venezuela (UTC-4) sigue en el día anterior una hora después de que Argentina ya cruzó', () => {
    // 03:30 UTC → 00:30 en Argentina (ya es 02/08) pero 23:30 en Venezuela (todavía 01/08)
    const at = new Date('2026-08-02T03:30:00Z');
    expect(localDateString(-3, at)).toBe('2026-08-02');
    expect(localDateString(-4, at)).toBe('2026-08-01');
    // una hora más tarde, Venezuela también cruza a 02/08
    const later = new Date('2026-08-02T04:30:00Z');
    expect(localDateString(-3, later)).toBe('2026-08-02');
    expect(localDateString(-4, later)).toBe('2026-08-02');
  });
});

describe('addDays', () => {
  it('suma días cruzando el fin de mes', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
  });

  it('resta días con un negativo', () => {
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
  });

  it('suma varios días', () => {
    expect(addDays('2026-08-01', 3)).toBe('2026-08-04');
  });
});

describe('dateOnly', () => {
  it('normaliza un Date a YYYY-MM-DD', () => {
    expect(dateOnly(new Date('2026-08-01T00:00:00.000Z'))).toBe('2026-08-01');
  });

  it('deja un string ya en formato fecha intacto', () => {
    expect(dateOnly('2026-08-01')).toBe('2026-08-01');
  });
});
