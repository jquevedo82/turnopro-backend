import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateAppointmentDto } from './create-appointment.dto';

function buildValid(overrides = {}): CreateAppointmentDto {
  return plainToInstance(CreateAppointmentDto, {
    professionalId: 1,
    serviceId: 1,
    date: '2026-04-10',
    startTime: '10:00',
    clientName: 'Juan Pérez',
    clientEmail: 'juan@example.com',
    clientPhone: '+5491155556666',
    ...overrides,
  });
}

describe('CreateAppointmentDto — validaciones', () => {
  it('acepta un DTO válido sin errores', async () => {
    const errors = await validate(buildValid());
    expect(errors).toHaveLength(0);
  });

  it('rechaza email inválido', async () => {
    const errors = await validate(buildValid({ clientEmail: 'no-es-un-email' }));
    const emailErr = errors.find(e => e.property === 'clientEmail');
    expect(emailErr).toBeDefined();
    expect(emailErr?.constraints?.isEmail).toBeDefined();
  });

  it('rechaza email vacío', async () => {
    const errors = await validate(buildValid({ clientEmail: '' }));
    expect(errors.find(e => e.property === 'clientEmail')).toBeDefined();
  });

  it('acepta email con subdominio y +alias', async () => {
    const errors = await validate(buildValid({ clientEmail: 'user+tag@mail.example.com' }));
    expect(errors.find(e => e.property === 'clientEmail')).toBeUndefined();
  });

  it('rechaza teléfono con letras', async () => {
    const errors = await validate(buildValid({ clientPhone: 'ABC123' }));
    expect(errors.find(e => e.property === 'clientPhone')).toBeDefined();
  });

  it('acepta teléfono con + y espacios', async () => {
    const errors = await validate(buildValid({ clientPhone: '+54 9 11 5555 6666' }));
    expect(errors.find(e => e.property === 'clientPhone')).toBeUndefined();
  });

  it('rechaza notes que supera 500 caracteres', async () => {
    const errors = await validate(buildValid({ notes: 'a'.repeat(501) }));
    expect(errors.find(e => e.property === 'notes')).toBeDefined();
  });
});
