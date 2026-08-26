import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateScheduleDto, CreateExceptionDto } from './create-schedule.dto';

describe('CreateScheduleDto — formato de hora', () => {
  const build = (overrides = {}) =>
    plainToInstance(CreateScheduleDto, { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', ...overrides });

  it('acepta un horario válido', async () => {
    const errors = await validate(build());
    expect(errors).toHaveLength(0);
  });

  it('rechaza hora fuera de rango (antes pasaba la validación)', async () => {
    const errors = await validate(build({ startTime: '25:99' }));
    expect(errors.find((e) => e.property === 'startTime')).toBeDefined();
  });

  it('rechaza formato sin cero a la izquierda', async () => {
    const errors = await validate(build({ startTime: '9:00' }));
    expect(errors.find((e) => e.property === 'startTime')).toBeDefined();
  });

  it('acepta 00:00 y 23:59 como límites válidos', async () => {
    const errors = await validate(build({ startTime: '00:00', endTime: '23:59' }));
    expect(errors).toHaveLength(0);
  });
});

describe('CreateExceptionDto — formato de hora opcional', () => {
  const build = (overrides = {}) =>
    plainToInstance(CreateExceptionDto, { date: '2026-08-26', ...overrides });

  it('acepta sin customStartTime/customEndTime (son opcionales)', async () => {
    const errors = await validate(build());
    expect(errors).toHaveLength(0);
  });

  it('rechaza customStartTime con formato inválido', async () => {
    const errors = await validate(build({ customStartTime: '25:99' }));
    expect(errors.find((e) => e.property === 'customStartTime')).toBeDefined();
  });
});
