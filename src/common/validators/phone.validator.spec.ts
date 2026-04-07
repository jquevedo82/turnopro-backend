import { validatePhone } from './phone.validator';

describe('validatePhone()', () => {
  // ── Argentina ──────────────────────────────────────────────────────────────
  it('acepta número móvil argentino con 11 dígitos', () => {
    expect(validatePhone('+5491112345678')).toBe(true);   // 11 dígitos
  });

  it('acepta número fijo argentino con 10 dígitos', () => {
    expect(validatePhone('+541112345678')).toBe(true);    // 10 dígitos
  });

  it('acepta número argentino con espacios intermedios', () => {
    expect(validatePhone('+54 9 11 1234-5678')).toBe(true);
  });

  it('rechaza número argentino con 9 dígitos (muy corto)', () => {
    expect(validatePhone('+54911234567')).toBe(false);    // 9 dígitos
  });

  it('rechaza número argentino con 12 dígitos (muy largo)', () => {
    expect(validatePhone('+549111234567890')).toBe(false); // 12 dígitos
  });

  // ── Venezuela ──────────────────────────────────────────────────────────────
  it('acepta número venezolano con 10 dígitos', () => {
    expect(validatePhone('+584121234567')).toBe(true);    // 10 dígitos
  });

  it('acepta número venezolano con espacios intermedios', () => {
    expect(validatePhone('+58 412 123 4567')).toBe(true);
  });

  it('rechaza número venezolano con 9 dígitos', () => {
    expect(validatePhone('+58412123456')).toBe(false);    // 9 dígitos
  });

  it('rechaza número venezolano con 11 dígitos', () => {
    expect(validatePhone('+5841212345678')).toBe(false);  // 11 dígitos
  });

  // ── Otros países / formatos inválidos ─────────────────────────────────────
  it('rechaza número sin código de país', () => {
    expect(validatePhone('01112345678')).toBe(false);
  });

  it('rechaza código de país no soportado', () => {
    expect(validatePhone('+5511912345678')).toBe(false);  // Brasil
  });

  it('rechaza string vacío', () => {
    expect(validatePhone('')).toBe(false);
  });

  it('rechaza valor no string', () => {
    expect(validatePhone(null)).toBe(false);
    expect(validatePhone(undefined)).toBe(false);
    expect(validatePhone(123456789)).toBe(false);
  });
});
